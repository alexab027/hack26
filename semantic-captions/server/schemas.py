"""Pydantic models for frontend/backend HTTP and WebSocket messages."""

from typing import Literal

from pydantic import BaseModel, Field


class AudioCue(BaseModel):
    """Timestamped model output compatible with the shared event contract."""

    type: Literal["audio_cue"] = "audio_cue"
    start: float = Field(ge=0)
    end: float = Field(ge=0)
    category: Literal["prosody", "emotion", "environment"]
    label: str
    confidence: float = Field(ge=0, le=1)


# TODO: Add incoming audio-window metadata and validation that end >= start.

