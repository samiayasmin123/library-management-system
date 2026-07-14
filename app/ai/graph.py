from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode, tools_condition

from app.ai.state import ChatState
from app.ai.llm import get_llm
from app.ai.tools import make_tools
from app.ai.prompts import SYSTEM_PROMPT
from app.ai.checkpointer import checkpointer
from app.database import SessionLocal


# ---------------------------------------------------------------
# Module-level LLM + tool schemas
# ---------------------------------------------------------------
# make_tools(db, user_id) needs a real, live DB session and a real
# user_id to actually run a tool - but a DB session can't stay open
# for the app's entire lifetime, and there's no real user yet at
# import time. So we build a throwaway set of tools here just so
# the LLM can learn each tool's name, description, and argument
# schema via bind_tools(). These dummy tools are only ever used for
# that schema-reading purpose - they are never invoked with db=None
# or user_id=None. Real tools, bound to a real session and real
# user, are built fresh inside tool_node() for every request.

llm = get_llm()

_schema_only_tools = make_tools(db=None, user_id=None)

llm_with_tools = llm.bind_tools(_schema_only_tools)


# ---------------------------------------------------------------
# LLM node
# ---------------------------------------------------------------

def llm_node(state: ChatState):

    messages = [SYSTEM_PROMPT] + state["messages"]

    result = llm_with_tools.invoke(messages)

    return {"messages": [result]}


# ---------------------------------------------------------------
# Tool node
# ---------------------------------------------------------------
# Opens a real DB session and builds the real tools for this one
# request/user, delegates the actual dispatch-by-tool_calls logic to
# a fresh ToolNode built from those real tools, then closes the
# session. This keeps each request's DB session properly scoped
# while still using LangGraph's own ToolNode machinery to match
# AIMessage.tool_calls to the right tool function.

def tool_node(state: ChatState):

    db = SessionLocal()

    try:

        real_tools = make_tools(db, state["user_id"])

        executor = ToolNode(real_tools)

        result = executor.invoke(state)

        db.commit()

        return result

    finally:

        db.close()


# ---------------------------------------------------------------
# Build the graph
# ---------------------------------------------------------------

builder = StateGraph(ChatState)

builder.add_node("llm", llm_node)
builder.add_node("tools", tool_node)

builder.set_entry_point("llm")

builder.add_conditional_edges("llm", tools_condition)
builder.add_edge("tools", "llm")

graph = builder.compile(checkpointer=checkpointer)