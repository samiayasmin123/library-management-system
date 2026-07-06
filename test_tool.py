from app.ai.agent import agent

result = agent.run_sync(
    "Search for Harry Potter"
)

print(result.output)