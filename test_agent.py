from app.ai.agent import agent


result = agent.run_sync(
    "Hello! Who are you?"
)

print(result.output)