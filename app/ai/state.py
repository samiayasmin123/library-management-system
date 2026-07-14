from langgraph.graph import MessagesState


class ChatState(MessagesState):
    """
    Conversation state for the library assistant.

    `messages` is inherited from MessagesState:
        messages: Annotated[list[AnyMessage], add_messages]

    The add_messages reducer appends new messages onto the existing
    list instead of overwriting it, which is what gives the graph
    multi-turn memory across invocations.

    A HumanMessage carries the user's input, an AIMessage with
    tool_calls encodes the model's intent, a ToolMessage carries a
    tool's result back, and the final AIMessage with plain text
    content is the response shown to the user. None of these are
    separate state fields anymore - they're just messages in the list.
    """

    user_id: int
    session_id: int