"""FastAPI entry point for saved and live audio analysis."""

import asyncio
import logging
from contextlib import asynccontextmanager
from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import FastAPI, File, HTTPException, Query, UploadFile, WebSocket
from soundfile import SoundFileError

from server.analysis.sounds import analyze_environmental_audio
from server.audio.preprocess import load_audio_bytes
from server.live_audio import stream_audio_cues
from server.models.sound_model import SoundModel
from server.schemas import AudioCue

logger = logging.getLogger(__name__)
sound_model = SoundModel()


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    """Warm AST off the event loop before accepting live audio sessions."""
    logger.info("Warming up the AST sound classifier")
    try:
        await asyncio.to_thread(sound_model.warm_up)
    except Exception:
        logger.exception(
            "AST warm-up failed; the server will continue and retry on first inference"
        )
    else:
        logger.info("AST sound classifier warm-up complete")
    yield


app = FastAPI(title="Semantic Captions Audio Analysis", lifespan=lifespan)


@app.get("/health")
async def health() -> dict[str, str]:
    """Provide a lightweight readiness target without running model inference."""
    return {"status": "ok"}


@app.post("/analyze/file", response_model=list[AudioCue])
async def analyze_file(
    file: Annotated[UploadFile, File(description="WAV, FLAC, or OGG audio file")],
    threshold: Annotated[float, Query(ge=0, le=1)] = 0.15,
) -> list[AudioCue]:
    """Analyze an uploaded audio file and return environmental cue events."""
    try:
        audio, sample_rate = load_audio_bytes(await file.read())
        return analyze_environmental_audio(
            audio, sample_rate, sound_model, confidence_threshold=threshold
        )
    except (ValueError, SoundFileError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.websocket("/ws/analyze")
async def analyze_live(websocket: WebSocket) -> None:
    """Analyze continuous browser Float32 PCM without blocking the event loop."""
    await stream_audio_cues(websocket, sound_model)
