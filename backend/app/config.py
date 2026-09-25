"""Application configuration loaded from environment variables / .env file."""

from __future__ import annotations

import os

from dotenv import load_dotenv

# Load .env from the repo root (one level above backend/)
_root = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
load_dotenv(_root)


def _env(*names: str, default: str = "") -> str:
    """Return the first non-empty environment variable among names."""
    for name in names:
        value = os.environ.get(name)
        if value:
            return value
    return default


class Config:
    # Any OpenAI-compatible provider (OpenAI, Gemini, LiteLLM, ...).
    # OPENAI_* names are still accepted so existing .env files keep working.
    openai_api_key: str = _env("OPENAI_COMPATIBLE_API_KEY", "OPENAI_API_KEY")
    openai_base_url: str | None = (
        _env("OPENAI_COMPATIBLE_BASE_URL", "OPENAI_BASE_URL") or None
    )
    openai_model: str = _env(
        "OPENAI_COMPATIBLE_MODEL", "OPENAI_MODEL", default="gpt-4o-mini"
    )

    # Frontend CORS — allow Vite dev server and production builds
    cors_origins: list[str] = [
        "http://localhost:5173",  # Vite default
        "http://localhost:4173",  # Vite preview
        "http://localhost:3000",
    ]

    def validate(self) -> None:
        if not self.openai_api_key:
            raise RuntimeError(
                "OPENAI_COMPATIBLE_API_KEY is not set. "
                "Copy .env.example to .env and fill in your API key. "
                "OPENAI_API_KEY is still accepted."
            )


config = Config()
