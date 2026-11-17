# UniLink backend

COMP 4150, Step 5 (backend). Sriram Pragalathan (110156476) and Adedeji Adeboyejo (110125235).

This is a REST API in Python (FastAPI) that sits between the GUI and the PostgreSQL database from Step 4.

```
GUI  --HTTP/JSON-->  Backend (this folder)  --SQL-->  PostgreSQL (database/ folder)
```

## Setup

1. **Database.** Run the four files in `database/`, in order:
   ```bash
   createdb unilink
   cd database
   psql -d unilink -f 1_schema.sql -f 2_sample_data.sql -f 3_procedures_triggers.sql -f 6_user_accounts.sql
   ```
   `6_user_accounts.sql` is new. It adds the login table needed for the three user roles.
2. **Install packages** (Python 3.10 or newer):
   ```bash
   pip install -r requirements.txt
   ```
3. **Point the backend at your database.** The default is `postgresql://postgres:postgres@localhost:5432/unilink`. If yours is different, set it first:
   - macOS/Linux:
     ```bash
     export DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/unilink"
     ```
   - Windows PowerShell:
     ```powershell
     $env:DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/unilink"
     ```
4. **Run.**
   ```bash
   uvicorn main:app --reload
   ```
   Then open http://localhost:8000/docs.
5. **Test (optional).** On a freshly loaded database, run:
   ```bash
   python test_api.py
   ```
   It runs 52 checks across all three roles. Expected output is in `test_output.txt`.

## Files

| File | Purpose |
|---|---|
| `main.py` | Starts the app, login/logout, error formatting |
| `auth.py` | Password check (bcrypt, in the database), session tokens, role checks |
| `db.py` | Database connection; turns database errors into readable HTTP errors |
| `routes/common.py` | Search, section details, catalogue, dropdown lists (all roles) |
| `routes/student.py` | Register, drop, schedule, my courses |
| `routes/instructor.py` | My sections, class lists |
| `routes/admin.py` | Full CRUD on students, instructors, courses, prerequisites, sections and meetings; register or drop on a student's behalf; reports |
| `test_api.py` | End-to-end test of the requirement scenarios |
| `API_GUIDE.md` | **For the GUI developer**: every endpoint with example requests |

## How it maps to the requirements

- **Three user roles (FR1).** Student, Instructor and Admin. Every endpoint checks the role, and a wrong role gets 403.
- **CRUD.** Admins can create, read, update and delete students, instructors, courses, prerequisites, sections and meetings. Students create and delete their own enrollments.
- **Rules stay in the database (FR9).** Registering and dropping call the stored procedures, and the triggers still apply. The backend passes their messages, such as "Prerequisite not met: COMP 3300", straight to the GUI.
- **Security.**
  - **S1:** passwords are stored only as bcrypt hashes.
  - **S2:** roles are checked on every request. A student's ID always comes from their login, so they can't act as someone else.
  - **S3:** all SQL is parameterized, which prevents SQL injection.
- **All-or-nothing changes.** Each request runs in one transaction. For example, a new section and its meetings are saved together or not at all.

Sessions are kept in memory, so restarting the backend logs everyone out.
