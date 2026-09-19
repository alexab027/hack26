"""Live Float32 PCM buffering and non-blocking semantic analysis."""

from __future__ import annotations

import asyncio
import json
import logging
from contextlib import suppress
from dataclasses import dataclass
from typing import Any

import numpy as np
from fastapi import WebSocket, WebSocketDisconnect

from server.analysis.sounds import analyze_sounds
from server.audio.preprocess import preprocess_audio
from server.audio.windows import (
    DEFAULT_HOP_SECONDS,
    DEFAULT_WINDOW_SECONDS,
    AudioWindow,
)
from server.models.sound_model import SoundModel
from server.schemas import AudioCue

logger = logging.getLogger(__name__)

LIVE_CONFIDENCE_THRESHOLD = 0.15
MAX_PENDING_WINDOWS = 2
MIN_INPUT_SAMPLE_RATE = 8_000
MAX_INPUT_SAMPLE_RATE = 192_000


@dataclass
class LivePcmBuffer:
    """Turn continuous mono samples into complete timestamped AST windows."""

    sample_rate: int
    window_seconds: float = DEFAULT_WINDOW_SECONDS
    hop_seconds: float = DEFAULT_HOP_SECONDS

    def __post_init__(self) -> None:
        if self.sample_rate <= 0:
            raise ValueError("sample rate must be positive")
        self.window_samples = max(1, round(self.window_seconds * self.sample_rate))
        self.hop_samples = max(1, round(self.hop_seconds * self.sample_rate))
        self.total_samples = 0
        self.next_window_start = 0
        self._buffer_start = 0
        self._samples = np.empty(0, dtype=np.float32)

    def add_bytes(self, payload: bytes) -> list[AudioWindow]:
        """Decode one little-endian Float32 PCM message and return new windows."""
        if len(payload) % np.dtype("<f4").itemsize:
            raise ValueError("PCM byte length must be divisible by four")
        samples = np.frombuffer(payload, dtype="<f4")
        return self.add_samples(samples)

    def add_samples(self, samples: np.ndarray) -> list[AudioWindow]:
        """Append one mono chunk while retaining only samples needed in the future."""
        chunk = np.asarray(samples, dtype=np.float32)
        if chunk.ndim != 1:
            raise ValueError("live PCM must be mono")
        if not np.isfinite(chunk).all():
            raise ValueError("live PCM contains NaN or infinite samples")
        if chunk.size:
            self._samples = np.concatenate((self._samples, chunk))
            self.total_samples += int(chunk.size)

        windows: list[AudioWindow] = []
        buffered_end = self._buffer_start + self._samples.size
        while self.next_window_start + self.window_samples <= buffered_end:
            relative_start = self.next_window_start - self._buffer_start
            relative_end = relative_start + self.window_samples
            start_sample = self.next_window_start
            end_sample = start_sample + self.window_samples
            windows.append(
                AudioWindow(
                    samples=np.ascontiguousarray(
                        self._samples[relative_start:relative_end], dtype=np.float32
                    ),
                    sample_rate=self.sample_rate,
                    start=start_sample / self.sample_rate,
                    end=end_sample / self.sample_rate,
                )
            )
            self.next_window_start += self.hop_samples

        discard_count = self.next_window_start - self._buffer_start
        if discard_count > 0:
            self._samples = self._samples[discard_count:].copy()
            self._buffer_start = self.next_window_start
        return windows


class LiveCueMerger:
    """Merge each label's newest overlapping window and return update events."""

    def __init__(self) -> None:
        self._latest_by_label: dict[str, AudioCue] = {}

    def add(self, cue: AudioCue) -> AudioCue | None:
        previous = self._latest_by_label.get(cue.label)
        if previous is not None and cue.start < previous.end:
            merged = AudioCue(
                start=min(previous.start, cue.start),
                end=max(previous.end, cue.end),
                category=cue.category,
                label=cue.label,
                confidence=max(previous.confidence, cue.confidence),
            )
        else:
            merged = cue

        self._latest_by_label[cue.label] = merged
        if previous is not None and merged == previous:
            return None
        return merged


def analyze_live_window(audio_window: AudioWindow, model: SoundModel) -> list[AudioCue]:
    """Preprocess one native-rate live window, preserving session timestamps."""
    samples, sample_rate = preprocess_audio(audio_window.samples, audio_window.sample_rate)
    prepared = AudioWindow(
        samples=samples,
        sample_rate=sample_rate,
        start=audio_window.start,
        end=audio_window.end,
    )
    return analyze_sounds(
        prepared,
        model,
        confidence_threshold=LIVE_CONFIDENCE_THRESHOLD,
    )


def _parse_start_message(message: str) -> tuple[int, str]:
    try:
        payload: Any = json.loads(message)
    except json.JSONDecodeError as exc:
        raise ValueError("first message must be valid start JSON") from exc
    if not isinstance(payload, dict) or payload.get("type") != "start":
        raise ValueError("first message must have type 'start'")

    sample_rate = payload.get("sample_rate")
    session_id = payload.get("session_id")
    if not isinstance(sample_rate, int) or isinstance(sample_rate, bool):
        raise ValueError("sample_rate must be an integer")
    if not MIN_INPUT_SAMPLE_RATE <= sample_rate <= MAX_INPUT_SAMPLE_RATE:
        raise ValueError(
            f"sample_rate must be between {MIN_INPUT_SAMPLE_RATE} and "
            f"{MAX_INPUT_SAMPLE_RATE}"
        )
    if not isinstance(session_id, str) or not session_id.strip():
        raise ValueError("session_id must be a non-empty string")
    return sample_rate, session_id[:128]


def _is_stop_message(message: str) -> bool:
    try:
        payload: Any = json.loads(message)
    except json.JSONDecodeError:
        return False
    return isinstance(payload, dict) and payload.get("type") == "stop"


async def _analysis_worker(
    websocket: WebSocket,
    queue: asyncio.Queue[AudioWindow],
    model: SoundModel,
    session_id: str,
) -> None:
    merger = LiveCueMerger()
    while True:
        audio_window = await queue.get()
        try:
            cues = await asyncio.to_thread(analyze_live_window, audio_window, model)
            for cue in cues:
                update = merger.add(cue)
                if update is not None:
                    await websocket.send_json(update.model_dump(mode="json"))
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.exception(
                "Live semantic inference failed for session %s at %.2f-%.2f seconds",
                session_id,
                audio_window.start,
                audio_window.end,
            )
            with suppress(Exception):
                await websocket.send_json(
                    {
                        "type": "semantic_error",
                        "message": "Semantic audio analysis failed for one window.",
                    }
                )
        finally:
            queue.task_done()


def _queue_latest_window(
    queue: asyncio.Queue[AudioWindow], window: AudioWindow, session_id: str
) -> None:
    if queue.full():
        skipped = queue.get_nowait()
        queue.task_done()
        logger.warning(
            "Semantic analyzer is behind for session %s; skipped stale window %.2f-%.2f",
            session_id,
            skipped.start,
            skipped.end,
        )
    queue.put_nowait(window)


async def stream_audio_cues(websocket: WebSocket, model: SoundModel) -> None:
    """Serve one browser PCM session over an accepted FastAPI WebSocket."""
    await websocket.accept()
    worker: asyncio.Task[None] | None = None
    queue: asyncio.Queue[AudioWindow] = asyncio.Queue(maxsize=MAX_PENDING_WINDOWS)
    graceful_stop = False

    try:
        first = await websocket.receive()
        if first.get("type") == "websocket.disconnect":
            return
        start_text = first.get("text")
        if not isinstance(start_text, str):
            raise ValueError("first WebSocket message must be start JSON")
        sample_rate, session_id = _parse_start_message(start_text)
        pcm_buffer = LivePcmBuffer(sample_rate)
        worker = asyncio.create_task(
            _analysis_worker(websocket, queue, model, session_id)
        )
        logger.info(
            "Started live semantic session %s at %d Hz", session_id, sample_rate
        )

        while True:
            message = await websocket.receive()
            if message.get("type") == "websocket.disconnect":
                break
            binary = message.get("bytes")
            text = message.get("text")
            if binary is not None:
                for window in pcm_buffer.add_bytes(binary):
                    _queue_latest_window(queue, window, session_id)
            elif isinstance(text, str) and _is_stop_message(text):
                graceful_stop = True
                break

        if graceful_stop:
            await queue.join()
            logger.info(
                "Stopped live semantic session %s after %d samples",
                session_id,
                pcm_buffer.total_samples,
            )
    except WebSocketDisconnect:
        pass
    except ValueError as exc:
        logger.warning("Rejected live semantic stream: %s", exc)
        with suppress(Exception):
            await websocket.send_json({"type": "semantic_error", "message": str(exc)})
    finally:
        if worker is not None:
            worker.cancel()
            with suppress(asyncio.CancelledError):
                await worker
        with suppress(Exception):
            await websocket.close()
