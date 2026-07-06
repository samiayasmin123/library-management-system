from pydantic_ai import Agent

from app.ai.llm import get_model
from app.ai.prompts import SYSTEM_PROMPT

model = get_model()

agent = Agent(
    model=model,
    system_prompt=SYSTEM_PROMPT,
)