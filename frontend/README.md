# UniLink GUI

React + Vite front end for the UniLink backend in the folder above.

## Run

1. Start the backend first (from the folder above): `uvicorn main:app --reload`
2. In this folder:
   ```bash
   npm install
   npm run dev
   ```
3. Open http://localhost:5173 and log in with a demo account, for example `aisha.khan` / `password123`.

The GUI calls `/api/...`, and Vite forwards those calls to `http://localhost:8000` (see `vite.config.js`).
To point it somewhere else, set `VITE_API_URL`, for example `VITE_API_URL=http://myserver:8000 npm run dev`.

## Screens

| Role | Screens |
|---|---|
| Student | **Plan my term**: search sections, register and drop, weekly timetable. Hovering a section shows it on the timetable, and time conflicts appear in red before you register. **My courses**: every term, with grades. **Course catalogue**. |
| Instructor | **My sections**: teaching timetable and class lists. **Course catalogue**. |
| Admin | **Sections** (create with meetings, edit, delete), **Students** and **Instructors** (create, edit, delete, register or drop a student), **Courses** (with prerequisites), **Reports** (enrollment per section and full sections). |

Error messages from the database rules, such as "Prerequisite not met: COMP 3300", are shown exactly as the backend sends them.

## Files

| File | Purpose |
|---|---|
| `src/api.js` | Every request goes through `api()`. Adds the login token and turns errors into messages. |
| `src/App.jsx` | Login check, top bar, term picker, screens for each role |
| `src/ui.jsx` | Shared pieces: timetable, seat meter, side drawer, toasts |
| `src/form.jsx` | Form builder used by the admin screens |
| `src/screens/` | One file per screen |
| `src/styles.css` | All styling, with light and dark themes |
