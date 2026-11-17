# UniLink API: guide for the GUI

The backend is a REST API. The GUI sends HTTP requests and gets JSON back. It works with any GUI technology: a web page (`fetch`), Python (`requests`), Java (`HttpClient`) or C# (`HttpClient`).

- **Base URL:** `http://localhost:8000`
- **Interactive docs:** open `http://localhost:8000/docs` while the backend is running. Every endpoint is listed with its fields, and you can try each one in the browser. To try a protected endpoint, click **Authorize** and paste the token from `/login`.

## 1. Log in

```
POST /login
{"username": "aisha.khan", "password": "password123"}
```
Response:
```json
{"token": "3f9c...", "username": "aisha.khan", "role": "Student", "linked_id": 110200001, "name": "Aisha Khan"}
```
1. Keep the `token` and send it on **every** other request as a header:
   ```
   Authorization: Bearer 3f9c...
   ```
2. Use `role` to choose which screens to show: **Student**, **Instructor** or **Admin**.

### Demo accounts

All demo accounts use the password `password123`.

| Role | Username |
|---|---|
| Student | `aisha.khan`, `marcus.johnson`, `priya.patel`, `fatou.diallo`, … (email before the @) |
| Instructor | `grace.okafor`, `wei.li`, `rahul.mehta`, `james.wilson`, `fatima.haddad` |
| Admin | `linda.carter`, `kevin.nguyen` |

## 2. Errors

When something fails, the body always looks like this:
```json
{"detail": "Prerequisite not met: COMP 3300"}
```
The `detail` text is written for users, so **show it directly in the GUI** (for example, in a message box).

| Status | Meaning | Example |
|---|---|---|
| 400 | A business rule refused it | "Section full", "Time conflict with COMP 3340 on Tue 11:30", "Double-booked: …" |
| 401 | Not logged in or session expired | Send the user back to the login screen |
| 403 | The user's role can't do this | A student calling an admin endpoint |
| 404 | Not found | |
| 409 | Duplicate, or a record is still in use | Deleting a student who has enrollments |
| 422 | A form field is invalid | "year_level: Input should be less than or equal to 6" |

## 3. Endpoints by screen

### All roles (after login)
| Method | Path | Use |
|---|---|---|
| GET | `/me` | Who is logged in |
| POST | `/logout` | Log out |
| GET | `/sections?term_id=&keyword=&dept_id=&instructor=&day=` | Course search screen. All filters are optional. |
| GET | `/sections/{section_id}` | Section details: meetings and prerequisites |
| GET | `/courses?dept_id=` | Course catalogue |
| GET | `/terms` | Term dropdown (`registration_open` is true or false) |
| GET | `/departments`, `/rooms`, `/instructors` | Other dropdowns |

### Student
| Method | Path | Use |
|---|---|---|
| GET | `/student/profile` | My details |
| GET | `/student/schedule?term_id=W2027` | Weekly timetable. One row per class meeting (day, start, end, course, room). |
| GET | `/student/enrollments` | My courses: Enrolled, Dropped, and Completed with grade |
| POST | `/student/enrollments` with `{"section_id": 13}` | Register. Responds with the seats left. |
| DELETE | `/student/enrollments/{section_id}` | Drop |

### Instructor
| Method | Path | Use |
|---|---|---|
| GET | `/instructor/sections?term_id=` | Sections I teach, with enrolled and seats left |
| GET | `/instructor/sections/{section_id}/students` | Class list |

### Admin: CRUD

Students and instructors follow the same pattern:

| Action | Request |
|---|---|
| List / search | `GET /admin/students?search=khan` |
| Read | `GET /admin/students/{id}` |
| Create | `POST /admin/students` |
| Update | `PUT /admin/students/{id}` |
| Delete | `DELETE /admin/students/{id}` |

```json
POST /admin/students
{"student_id": 110200050, "first_name": "Ada", "last_name": "Lovelace",
 "email": "ada.lovelace@uwindsor.ca", "phone": "519-555-0150",
 "date_of_birth": "2006-12-10", "year_level": 1, "major_dept_id": "COMP",
 "password": "welcome2026"}
```
Creating a student also creates their login. The username is the email before the @, here `ada.lovelace`. For `PUT`, send the same fields without `student_id` and `password`.

Instructors work the same way at `/admin/instructors`. Their fields are: `instructor_id`, `first_name`, `last_name`, `email`, `office_location`, `dept_id`, `password`.

| Method | Path | Use |
|---|---|---|
| POST / PUT / DELETE | `/admin/courses`, `/admin/courses/{code}` | Courses. Fields: `course_code`, `title`, `description`, `credits`, `dept_id`. |
| POST / DELETE | `/admin/courses/{code}/prerequisites[/{prereq_code}]` | Prerequisites. Body: `{"prereq_course_code": "COMP 2540", "min_grade": "C"}` |
| GET | `/admin/sections?term_id=` | All sections in a term |
| POST | `/admin/sections` | Create a section with its meetings (example below) |
| PUT | `/admin/sections/{id}` | `{"instructor_id": 5001, "enrollment_limit": 50}` (optional `"status": "Closed"`) |
| DELETE | `/admin/sections/{id}` | Delete (only works if nobody has enrolled) |
| POST / DELETE | `/admin/sections/{id}/meetings`, `/admin/meetings/{meeting_id}` | Add or remove a meeting time |
| GET | `/admin/students/{id}/enrollments` | A student's registration history |
| POST | `/admin/enrollments` with `{"student_id": …, "section_id": …}` | Register a student. The deadline doesn't apply. |
| DELETE | `/admin/enrollments/{student_id}/{section_id}` | Drop a student |
| GET | `/admin/reports/enrollment?term_id=W2027` | Enrollment report (`percent_full` per section) |
| GET | `/admin/reports/full-sections` | Full sections in current and future terms |

```json
POST /admin/sections
{"course_code": "COMP 3540", "term_id": "W2027", "section_number": 2,
 "instructor_id": 5002, "enrollment_limit": 35,
 "meetings": [{"day_of_week": "Mon", "start_time": "16:00", "end_time": "17:20", "room_id": 1},
              {"day_of_week": "Wed", "start_time": "16:00", "end_time": "17:20", "room_id": 1}]}
```

### Notes

- Course codes contain a space, for example `COMP 3150`. Most HTTP libraries encode it in URLs automatically; if yours doesn't, write it as `COMP%203150`.
- Dates are sent as `"YYYY-MM-DD"` and times as `"HH:MM"`.

## 4. Short client examples

**Python (`requests`):**
```python
import requests
API = "http://localhost:8000"
token = requests.post(f"{API}/login", json={"username": "aisha.khan", "password": "password123"}).json()["token"]
headers = {"Authorization": f"Bearer {token}"}

r = requests.post(f"{API}/student/enrollments", json={"section_id": 13}, headers=headers)
if r.ok:
    print("Registered!", r.json()["section"]["seats_left"], "seats left")
else:
    print("Error:", r.json()["detail"])          # show this in the GUI
```

**JavaScript (web page):**
```js
const res = await fetch("http://localhost:8000/student/enrollments", {
  method: "POST",
  headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
  body: JSON.stringify({ section_id: 13 })
});
const data = await res.json();
if (!res.ok) alert(data.detail);
```
