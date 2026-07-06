from pydantic_ai.models.google import GoogleModel
from pydantic_ai.providers.google import GoogleProvider

from app.config import settings


def get_model():
    provider = settings.LLM_PROVIDER.lower()

    if provider == "gemini":
        return GoogleModel(
            settings.MODEL_NAME,
            provider=GoogleProvider(
                api_key=settings.GEMINI_API_KEY
            )
        )

    raise ValueError(f"Unsupported provider: {provider}")