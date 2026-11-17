"""
UniLink backend - REST API used by the GUI.

Run:    uvicorn main:app --reload
Docs:   http://localhost:8000/docs   (try every endpoint in the browser)
"""
from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

import auth
from routes import admin, common, instructor, student

app = FastAPI(
    title="UniLink API",
    description="Backend for the UniLink University Course Registration System (COMP 4150).",
    version="1.0",
)

# Allow a web GUI served from another address (e.g. localhost:5173) to call the API
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.exception_handler(RequestValidationError)
def validation_error(request: Request, exc: RequestValidationError):
    """Turn form-validation errors into one readable message for the GUI,
    e.g. "year_level: Input should be less than or equal to 6"."""
    messages = [f"{err['loc'][-1]}: {err['msg']}" for err in exc.errors()]
    return JSONResponse(status_code=422, content={"detail": "; ".join(messages)})


class LoginRequest(BaseModel):
    username: str
    password: str


@app.post("/login", tags=["Login"], summary="Log in (Use case 01)")
def login(body: LoginRequest):
    """Returns a token plus the user's role, ID and name. The GUI uses the
    role to decide which screens to show, and sends the token on every
    request as:  Authorization: Bearer <token>"""
    return auth.login(body.username, body.password)


@app.post("/logout", tags=["Login"], summary="Log out")
def logout(token: str = Depends(auth.get_token)):
    auth.logout(token)
    return {"message": "Logged out"}


@app.get("/me", tags=["Login"], summary="Who is logged in")
def me(user=Depends(auth.current_user)):
    return user


app.include_router(common.router)
app.include_router(student.router)
app.include_router(instructor.router)
app.include_router(admin.router)
