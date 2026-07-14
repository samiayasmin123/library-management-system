from app.config import settings


def get_llm():

    provider = settings.LLM_PROVIDER.lower()

    if provider == "gemini":

        from langchain_google_genai import ChatGoogleGenerativeAI

        return ChatGoogleGenerativeAI(
            model=settings.MODEL_NAME,
            google_api_key=settings.GEMINI_API_KEY,
            temperature=0,
        )

    elif provider == "openai":

        from langchain_openai import ChatOpenAI

        return ChatOpenAI(
            model=settings.MODEL_NAME,
            api_key=settings.OPENAI_API_KEY,
            temperature=0,
        )

    elif provider == "anthropic":

        from langchain_anthropic import ChatAnthropic

        return ChatAnthropic(
            model=settings.MODEL_NAME,
            api_key=settings.ANTHROPIC_API_KEY,
            temperature=0,
        )

    elif provider == "ollama":

        from langchain_ollama import ChatOllama

        return ChatOllama(
            model=settings.MODEL_NAME,
            base_url=settings.OLLAMA_BASE_URL,
            temperature=0,
        )

    else:

        raise ValueError(
            f"Unsupported LLM_PROVIDER: '{settings.LLM_PROVIDER}'. "
            "Expected one of: gemini, openai, anthropic, ollama."
        )