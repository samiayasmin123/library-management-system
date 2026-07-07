fetch("/chat", {
    method: "POST",
    headers: {
        "Content-Type": "application/json"
    },
    body: JSON.stringify({
        session_id: sessionId,
        user_id: userId,
        message: message
    })
});