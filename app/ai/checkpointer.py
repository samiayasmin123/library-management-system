# ---------------------------------------------------------------
# Production checkpointer (Postgres)
# ---------------------------------------------------------------
# Persists graph state to the same Postgres database the rest of
# the app already uses, instead of a local SQLite file. This is
# what allows conversation state (and therefore interrupt()-based
# borrow/return confirmations) to work correctly even when the app
# is deployed across multiple server instances, since every
# instance reads and writes checkpoints from the same shared place.
#
# NOTE: PostgresSaver.from_conn_string(...) - the pattern shown in
# LangGraph's own docs - returns a context manager in this package
# version, not a ready-to-use saver, exactly like the SqliteSaver
# issue documented below. Constructing PostgresSaver directly from
# a psycopg connection pool avoids that entirely.
#
# This uses psycopg (psycopg3), NOT psycopg2 - the driver the rest
# of the app uses via SQLAlchemy. The two coexist in this project;
# LangGraph's checkpoint package requires psycopg3 specifically.

from psycopg_pool import ConnectionPool
from langgraph.checkpoint.postgres import PostgresSaver

from app.config import settings

_pool = ConnectionPool(
    conninfo=settings.DATABASE_URL,
    max_size=20,
    kwargs={"autocommit": True, "prepare_threshold": 0},
)

checkpointer = PostgresSaver(_pool)

# Creates LangGraph's internal checkpoint tables in Postgres if they
# don't already exist. Safe to call every time the app starts -
# it's a no-op once the tables are already present.
checkpointer.setup()


# ---------------------------------------------------------------
# Development checkpointer (SQLite) - kept here for reference.
# Swap back to this for local development by commenting out the
# block above and uncommenting this one instead.
# ---------------------------------------------------------------
#
# import sqlite3
# from langgraph.checkpoint.sqlite import SqliteSaver
#
# _conn = sqlite3.connect("chat_checkpoints.db", check_same_thread=False)
# checkpointer = SqliteSaver(_conn)