"""
Login and role checks (Use case 01, FR1, security requirement S2).

1. The GUI sends a username and password to POST /login.
2. The password is checked against the bcrypt hash in UserAccount
   (inside the database, with pgcrypto's crypt function).
3. On success the backend returns a random token. The GUI sends it with
   every later request in the header:   Authorization: Bearer <token>
4. Each endpoint declares which roles may use it, e.g.
   Depends(require_role("Admin")). Any other role gets 403 Forbidden.

Sessions are kept in memory, so restarting the backend logs everyone out.
"""
import secrets

from fastapi import Depends, Header, HTTPException

from db import fetch_one

# token -> {"username", "role", "linked_id", "name"}
sessions: dict[str, dict] = {}


def login(username: str, password: str) -> dict:
    user = fetch_one(
        """
        SELECT Username AS username, Role AS role, LinkedID AS linked_id
        FROM UserAccount
        WHERE Username = %s AND PasswordHash = crypt(%s, PasswordHash)
        """,
        (username.strip().lower(), password),
    )
    if user is None:
        # same message for unknown user and wrong password
        raise HTTPException(401, "Invalid username or password")

    table, key = {
        "Student": ("Student", "StudentID"),
        "Instructor": ("Instructor", "InstructorID"),
        "Admin": ("Administrator", "AdminID"),
    }[user["role"]]
    person = fetch_one(
        f"SELECT FirstName || ' ' || LastName AS name FROM {table} WHERE {key} = %s",
        (user["linked_id"],),
    )
    user["name"] = person["name"] if person else user["username"]

    token = secrets.token_hex(24)
    sessions[token] = user
    return {"token": token, **user}


def logout(token: str):
    sessions.pop(token, None)


def get_token(authorization: str | None = Header(None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Not logged in")
    return authorization.removeprefix("Bearer ").strip()


def current_user(token: str = Depends(get_token)) -> dict:
    user = sessions.get(token)
    if user is None:
        raise HTTPException(401, "Session expired or invalid - please log in again")
    return user


def require_role(*roles: str):
    """Dependency that only lets the given roles through."""
    def checker(user: dict = Depends(current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(403, f"This action is only for: {', '.join(roles)}")
        return user
    return checker
