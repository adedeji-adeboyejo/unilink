"""
End-to-end test of the UniLink API against the real database.
Acts out the Requirements Document scenarios for all three roles.

Run on a freshly loaded database (it registers and drops students):
    python test_api.py
"""
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)
passed = failed = 0


def check(label, response, expected_status, contains=None):
    """Print PASS/FAIL for one request and return its JSON body."""
    global passed, failed
    body = response.json()
    ok = response.status_code == expected_status and (contains is None or contains in str(body))
    passed += ok
    failed += not ok
    detail = body.get("detail") or body.get("message") if isinstance(body, dict) else f"{len(body)} rows"
    print(f"{'PASS' if ok else 'FAIL'}  [{response.status_code}] {label}  ->  {detail}")
    return body


def login(username):
    body = client.post("/login", json={"username": username, "password": "password123"}).json()
    return {"Authorization": f"Bearer {body['token']}"}


print("\n=== Login and roles (Use case 01) ===")
check("Wrong password is refused", client.post("/login", json={"username": "aisha.khan", "password": "nope"}), 401)
check("No token -> not logged in", client.get("/sections"), 401)
aisha = login("aisha.khan")
marcus = login("marcus.johnson")
okafor = login("grace.okafor")
admin = login("linda.carter")
check("Aisha logs in as Student", client.get("/me", headers=aisha), 200, "Student")
check("Student cannot use admin pages", client.get("/admin/students", headers=aisha), 403)
check("Instructor cannot register for courses", client.post("/student/enrollments", json={"section_id": 13}, headers=okafor), 403)

print("\n=== Scenario 1: Aisha searches and registers (Use cases 02, 03, 04, 06) ===")
results = check("Search 'database' in Winter 2027", client.get("/sections", params={"term_id": "W2027", "keyword": "database"}, headers=aisha), 200, "COMP 3150")
check("Section details with prerequisites", client.get("/sections/13", headers=aisha), 200, "COMP 2540")
check("Register for COMP 3150 section 02", client.post("/student/enrollments", json={"section_id": 13}, headers=aisha), 201, "'seats_left': 11")
check("It appears in her weekly schedule", client.get("/student/schedule", params={"term_id": "W2027"}, headers=aisha), 200, "COMP 3150")

print("\n=== Scenario 2: Marcus is rejected with a clear reason ===")
check("COMP 4300 without COMP 3300", client.post("/student/enrollments", json={"section_id": 16}, headers=marcus), 400, "Prerequisite not met: COMP 3300")
check("COMP 3150-01 clashes with COMP 3340", client.post("/student/enrollments", json={"section_id": 12}, headers=marcus), 400, "Time conflict")
check("COMP 3150-02 fits", client.post("/student/enrollments", json={"section_id": 13}, headers=marcus), 201)

print("\n=== Scenario 3: last seat in COMP 4300 ===")
check("Fatou takes the last seat", client.post("/student/enrollments", json={"section_id": 16}, headers=login("fatou.diallo")), 201, "'seats_left': 0")
check("Jack is told it is full", client.post("/student/enrollments", json={"section_id": 16}, headers=login("jack.sullivan")), 400, "Section full")

print("\n=== Drop a course (Use case 05) ===")
check("Aisha drops COMP 3540 (Winter 2027)", client.delete("/student/enrollments/15", headers=aisha), 200)
check("Drop after the Fall 2026 deadline is refused", client.delete("/student/enrollments/9", headers=aisha), 400, "deadline")
check("History shows the dropped course", client.get("/student/enrollments", headers=aisha), 200, "Dropped")

print("\n=== Scenario 4: Dr. Okafor views her classes (Use cases 07, 08) ===")
check("Her Winter 2027 sections", client.get("/instructor/sections", params={"term_id": "W2027"}, headers=okafor), 200, "COMP 3150")
check("Class list for her section", client.get("/instructor/sections/13/students", headers=okafor), 200, "Khan")
check("Another instructor's class list is refused", client.get("/instructor/sections/16/students", headers=okafor), 403)

print("\n=== Scenario 5 and admin CRUD (Use cases 09-13) ===")
# Students: create, read, update, delete
new_student = {"student_id": 110299001, "first_name": "Test", "last_name": "Student",
               "email": "test.student@uwindsor.ca", "year_level": 1, "major_dept_id": "COMP",
               "password": "welcome2026"}
check("Create student + login", client.post("/admin/students", json=new_student, headers=admin), 201)
check("Duplicate student is refused", client.post("/admin/students", json=new_student, headers=admin), 409)
check("New student can log in", client.post("/login", json={"username": "test.student", "password": "welcome2026"}), 200)
check("Read student", client.get("/admin/students/110299001", headers=admin), 200, "Test")
check("Search students", client.get("/admin/students", params={"search": "khan"}, headers=admin), 200, "Aisha")
updated = {k: v for k, v in new_student.items() if k not in ("student_id", "password")} | {"year_level": 2}
check("Update student", client.put("/admin/students/110299001", json=updated, headers=admin), 200)
check("Invalid year level is refused", client.put("/admin/students/110299001", json=updated | {"year_level": 9}, headers=admin), 422)
check("Delete student", client.delete("/admin/students/110299001", headers=admin), 200)
check("Deleted student is gone", client.get("/admin/students/110299001", headers=admin), 404)
check("Student with enrollments cannot be deleted", client.delete("/admin/students/110200001", headers=admin), 409)

# Instructors
new_instr = {"instructor_id": 5099, "first_name": "Ana", "last_name": "Souza", "email": "ana.souza@uwindsor.ca",
             "office_location": "Lambton Tower 5160", "dept_id": "COMP", "password": "welcome2026"}
check("Create instructor", client.post("/admin/instructors", json=new_instr, headers=admin), 201)
check("Update instructor", client.put("/admin/instructors/5099", json={k: v for k, v in new_instr.items() if k not in ("instructor_id", "password")} | {"office_location": "LT 5170"}, headers=admin), 200)

# Courses and prerequisites
check("Create course", client.post("/admin/courses", json={"course_code": "COMP 4670", "title": "Introduction to Cloud Computing", "credits": 3, "dept_id": "COMP"}, headers=admin), 201)
check("Add prerequisite", client.post("/admin/courses/COMP 4670/prerequisites", json={"prereq_course_code": "COMP 3300", "min_grade": "C-"}, headers=admin), 201)
check("Update course", client.put("/admin/courses/COMP 4670", json={"title": "Cloud Computing", "credits": 3, "dept_id": "COMP"}, headers=admin), 200)
check("Course appears in catalogue", client.get("/courses", headers=aisha), 200, "Cloud Computing")

# Sections (Use case 11)
clash = {"course_code": "COMP 4670", "term_id": "W2027", "section_number": 1, "instructor_id": 5003,
         "enrollment_limit": 30, "meetings": [{"day_of_week": "Mon", "start_time": "11:30", "end_time": "12:50", "room_id": 1}]}
check("Section that double-books Dr. Mehta is refused", client.post("/admin/sections", json=clash, headers=admin), 400, "Double-booked")
ok_section = clash | {"instructor_id": 5099, "meetings": [{"day_of_week": "Fri", "start_time": "10:00", "end_time": "12:50", "room_id": 1}]}
created = check("Section with new instructor on Friday", client.post("/admin/sections", json=ok_section, headers=admin), 201)
sid = created.get("section_id")
check("Students can find the new section", client.get("/sections", params={"keyword": "cloud"}, headers=aisha), 200, "Fri 10:00")
check("Change capacity", client.put(f"/admin/sections/{sid}", json={"instructor_id": 5099, "enrollment_limit": 25}, headers=admin), 200)
check("Capacity below enrollment is refused", client.put("/admin/sections/13", json={"instructor_id": 5001, "enrollment_limit": 1}, headers=admin), 400, "already enrolled")

# Registration on a student's behalf (Use case 12)
check("Admin drops Aisha from Fall 2026 after the deadline", client.delete("/admin/enrollments/110200001/9", headers=admin), 200)
check("Admin re-registers her", client.post("/admin/enrollments", json={"student_id": 110200001, "section_id": 9}, headers=admin), 201)
check("Admin still cannot exceed capacity", client.post("/admin/enrollments", json={"student_id": 110200012, "section_id": 16}, headers=admin), 400, "Section full")

# Reports (Use case 13)
check("Enrollment report for Winter 2027", client.get("/admin/reports/enrollment", params={"term_id": "W2027"}, headers=admin), 200, "percent_full")
check("Full sections report", client.get("/admin/reports/full-sections", headers=admin), 200, "COMP 4300")

# Clean up the records created above
check("Delete section", client.delete(f"/admin/sections/{sid}", headers=admin), 200)
check("Remove prerequisite", client.delete("/admin/courses/COMP 4670/prerequisites/COMP 3300", headers=admin), 200)
check("Delete course", client.delete("/admin/courses/COMP 4670", headers=admin), 200)
check("Delete instructor", client.delete("/admin/instructors/5099", headers=admin), 200)

print("\n=== Logout ===")
check("Log out", client.post("/logout", headers=aisha), 200)
check("Old token no longer works", client.get("/me", headers=aisha), 401)

print(f"\n{passed} passed, {failed} failed")
