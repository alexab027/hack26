"""FastAPI entry point for local file-based audio analysis."""

from typing import Annotated

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from soundfile import SoundFileError

from server.analysis.sounds import analyze_environmental_audio
from server.audio.preprocess import load_audio_bytes
from server.models.sound_model import SoundModel
from server.schemas import AudioCue

app = FastAPI(title="Semantic Captions Audio Analysis")
sound_model = SoundModel()


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


# Live browser audio transport comes after local file inference is validated.
