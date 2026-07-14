# ---------------------------------------------------------------
# Development checkpointer (SQLite)
# ---------------------------------------------------------------
# Persists graph state to a local file. This is what makes
# multi-turn memory and interrupt() work across separate requests
# for the same thread/session. Fine for local development; a single
# file isn't meant to be shared across multiple production workers.
#
# SqliteSaver.from_conn_string(...) returns a context manager in
# this version of langgraph-checkpoint-sqlite, not a ready-to-use
# saver - calling it directly and assigning the result (as the task
# spec originally showed) fails with:
#   TypeError: Invalid checkpointer provided ... Received
#   _GeneratorContextManager.
# Constructing SqliteSaver from a raw sqlite3 connection avoids
# that entirely. check_same_thread=False is required because
# FastAPI/uvicorn runs sync route handlers in a thread pool, and
# sqlite3 connections are single-thread-only by default.

import sqlite3

from langgraph.checkpoint.sqlite import SqliteSaver

_conn = sqlite3.connect("chat_checkpoints.db", check_same_thread=False)

checkpointer = SqliteSaver(_conn)


# ---------------------------------------------------------------
# Production checkpointer (Postgres)
# ---------------------------------------------------------------
# When deploying, comment out the SqliteSaver block above and
# uncomment this block instead. It reuses the same Postgres
# database the rest of the app already talks to.
#
# from app.config import settings
# from langgraph.checkpoint.postgres import PostgresSaver
#
# checkpointer = PostgresSaver.from_conn_string(settings.DATABASE_URL)
# checkpointer.setup()  # creates LangGraph's internal checkpoint tables if missing