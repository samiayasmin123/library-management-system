from app.ai.graph import graph

result = graph.invoke(
    {
        "session_id": 1,
        "user_id": 1,
        "message": "search Harry Potter",
        "book_id": None,
        "intent": "",
        "tool_result": {},
        "response": ""
    }
)

print(result["response"])