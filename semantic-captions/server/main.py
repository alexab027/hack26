"""FastAPI entry point for future HTTP/WebSocket live audio analysis endpoints."""

from fastapi import FastAPI

app = FastAPI(title="Semantic Captions Audio Analysis")


@app.get("/health")
async def health() -> dict[str, str]:
    """Provide a lightweight readiness target without running model inference."""
    return {"status": "ok"}


# TODO: Add a streaming endpoint that delegates preprocessing and analysis to modules.

