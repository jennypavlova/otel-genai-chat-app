"""OpenAI client factory.

Uses OPENAI_BASE_URL to support any OpenAI-compatible gateway (LiteLLM, Azure,
local models, etc.).  The openai-instrumentation-openai-v2 / EDOT instrumentation
wraps this client automatically when the process is started via
`opentelemetry-instrument` — no manual span code required here.
"""

from __future__ import annotations

import openai

from .config import config


def make_client() -> openai.OpenAI:
    """Return a configured synchronous OpenAI client.

    Pass base_url only when explicitly set so the default OpenAI endpoint is
    used when OPENAI_BASE_URL is empty.
    """
    kwargs: dict = {"api_key": config.openai_api_key}
    if config.openai_base_url:
        kwargs["base_url"] = config.openai_base_url
    return openai.OpenAI(**kwargs)


# Module-level singleton — the OTel instrumentation patches openai.OpenAI so
# the singleton is instrumented as soon as the process starts.
client = make_client()
