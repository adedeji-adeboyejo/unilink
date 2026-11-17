"""
Database access for the UniLink backend.

Every request opens a connection, runs its SQL and commits. If anything
fails, the whole request is rolled back, so a request either fully
succeeds or changes nothing.

All SQL uses %s / %(name)s placeholders. psycopg sends the values
separately from the SQL text, which is what prevents SQL injection
(security requirement S3).
"""
import os
from contextlib import contextmanager

import psycopg
from psycopg import errors
from psycopg.rows import dict_row
from fastapi import HTTPException

DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/unilink"
)


@contextmanager
def connect():
    """Open a connection; commit on success, roll back on error.

    Database errors are turned into HTTP errors with a readable message,
    so the GUI can show the message to the user directly.
    """
    try:
        with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
            yield conn
    except errors.RaiseException as e:
        # RAISE EXCEPTION in a stored procedure or trigger,
        # e.g. "Section full" or "Prerequisite not met: COMP 3300"
        raise HTTPException(400, e.diag.message_primary)
    except errors.UniqueViolation as e:
        raise HTTPException(409, f"Already exists: {e.diag.message_detail}")
    except errors.ForeignKeyViolation as e:
        raise HTTPException(409, f"Linked record problem: {e.diag.message_detail}")
    except (errors.CheckViolation, errors.NotNullViolation,
            errors.InvalidTextRepresentation, errors.InvalidDatetimeFormat) as e:
        raise HTTPException(400, f"Invalid value: {e.diag.message_primary}")
    except psycopg.OperationalError:
        raise HTTPException(503, "Cannot reach the database")


def fetch_all(sql, params=None):
    with connect() as conn:
        return conn.execute(sql, params).fetchall()


def fetch_one(sql, params=None):
    """Return one row as a dict, or None if there is no row."""
    with connect() as conn:
        return conn.execute(sql, params).fetchone()


def fetch_one_or_404(sql, params=None, what="Record"):
    row = fetch_one(sql, params)
    if row is None:
        raise HTTPException(404, f"{what} not found")
    return row


def execute(sql, params=None):
    """Run an INSERT/UPDATE/DELETE/CALL and return the number of rows affected."""
    with connect() as conn:
        return conn.execute(sql, params).rowcount


def execute_or_404(sql, params=None, what="Record"):
    if execute(sql, params) == 0:
        raise HTTPException(404, f"{what} not found")
