"""Pydantic models for frontend/backend HTTP and WebSocket messages."""

from typing import Literal

from pydantic import BaseModel, Field, model_validator


class AudioCue(BaseModel):
    """Timestamped model output compatible with the shared event contract."""

    type: Literal["audio_cue"] = "audio_cue"
    start: float = Field(ge=0)
    end: float = Field(ge=0)
    category: Literal["prosody", "emotion", "environment"]
    label: str
    confidence: float = Field(ge=0, le=1)

    @model_validator(mode="after")
    def validate_interval(self) -> "AudioCue":
        if self.end <= self.start:
            raise ValueError("end must be greater than start")
        return self
