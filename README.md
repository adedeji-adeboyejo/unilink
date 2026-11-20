# UniLink: University Course Registration System


**COMP 4150 (Advanced Database Systems) course project.**
Built by Sriram Pragalathan and Adedeji Adeboyejo (me).


UniLink is a course registration system for a university. Students search for sections, register, drop and see their weekly timetable. Instructors see the sections they teach and their class lists. Administrators manage students, instructors, courses, sections and enrollments, and run enrollment reports.

## Tech stack
- **Database:** PostgreSQL with the `pgcrypto` extension (for bcrypt password hashes)
- **Backend:** Python 3.10+, FastAPI, Uvicorn, psycopg 3
- **Frontend:** React 18 and Vite 5


```
React GUI  --HTTP/JSON-->  FastAPI backend  --SQL-->  PostgreSQL
localhost:5173             localhost:8000              database "unilink"
```

The business rules live in the database. Registering and dropping go through stored procedures, and triggers enforce capacity and scheduling rules. The backend passes the database's messages, such as "Prerequisite not met: COMP 3300", straight to the GUI.

### Rules the database enforces

- A student can register only while registration is open, if the section has a free seat, if they aren't already in that course this term, if they've completed the prerequisites with the minimum grade, and if there's no time conflict.
- Two students asking for the last seat can't both get it (the section row is locked).
- A section can't go over capacity, even through a direct insert. It becomes **Full** when the last seat is taken and **Open** again when someone drops.
- A room or instructor can't be booked at overlapping times in the same term.
- Capacity can't be set below the number of students already enrolled.
- Students can't register or drop after the term's add/drop deadline; an admin can.


## Getting started

### Prerequisites

- PostgreSQL
- Python 3.10 or newer
- Node.js 18 or newer

### 1. Create the database

```bash
createdb unilink
cd backend/database
psql -d unilink -f 1_schema.sql -f 2_sample_data.sql -f 3_procedures_triggers.sql -f 6_user_accounts.sql
```

### 2. Run the backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

The backend connects to `postgresql://postgres:postgres@localhost:5432/unilink` by default. If your username, password or port is different, set `DATABASE_URL` before starting it:

```bash
# macOS / Linux
export DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/unilink"
```
```powershell
# Windows PowerShell
$env:DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/unilink"
```

Open http://localhost:8000/docs to see and try every endpoint in the browser.

### 3. Run the frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 and log in with one of the demo accounts below. The GUI calls `/api/...`, and Vite forwards those calls to the backend on port 8000. To use a backend somewhere else, set `VITE_API_URL`.

### Demo accounts

Every demo account uses the password `password123`. A username is the part of the person's email before the @.

| Role | Usernames |
|---|---|
| Student | `aisha.khan`, `marcus.johnson`, `priya.patel`, `fatou.diallo`, … |
| Instructor | `grace.okafor`, `wei.li`, `rahul.mehta`, `james.wilson`, `fatima.haddad` |
| Admin | `linda.carter`, `kevin.nguyen` |


## Database design

| Table | Holds |
|---|---|
| `Department` | Academic departments |
| `Student`, `Instructor`, `Administrator` | The three kinds of user |
| `Course`, `Prerequisite` | The catalogue and which courses (with minimum grade) are needed first |
| `Term` | Terms, with start and end dates and the add/drop deadline |
| `Section`, `SectionMeeting`, `Room` | Offerings of a course in a term, their weekly meeting times and rooms |
| `Enrollment` | Which student is in which section: Enrolled, Waitlisted, Dropped or Completed, with grade |
| `UserAccount` | Login, role and bcrypt password hash for each user |


**Stored procedures:** `sp_register_student` and `sp_drop_course`.
**Triggers:** `trg_prevent_over_enrollment`, `trg_reopen_section`, `trg_no_double_booking` and `trg_capacity_not_below_enrolled`.


To run the sample queries and requirement scenarios directly in PostgreSQL:

```bash
cd backend/database
psql -d unilink -f 4_queries.sql
psql -d unilink -f 5_test_scenarios.sql
```


## Notes

- **Registration dates.** Registration checks use today's date. In the sample data, Winter 2027 registration is open until 2027-01-19 and the Fall 2026 deadline has passed. If you run the project after 2027-01-19, move the term dates forward in `2_sample_data.sql`.
- **Sessions are kept in memory**, so restarting the backend logs everyone out.
- **Course codes contain a space** (for example `COMP 3150`) and need URL encoding (`COMP%203150`) when used in a path.
