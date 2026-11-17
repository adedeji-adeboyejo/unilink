"""
Student endpoints (Use cases 04, 05, 06).
A student can only see and change their own records: the student ID
always comes from the login session, never from the request.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from auth import require_role
from db import execute, fetch_all, fetch_one_or_404

router = APIRouter(prefix="/student", tags=["Student"])
student_only = require_role("Student")


class RegisterRequest(BaseModel):
    section_id: int


# Shared queries (the admin page reuses them for any student)
ENROLLMENTS_SQL = """
SELECT e.EnrollmentID AS enrollment_id, s.SectionID AS section_id, s.TermID AS term_id,
       s.CourseCode AS course_code, c.Title AS title, s.SectionNumber AS section_number,
       c.Credits AS credits, e.Status AS status, e.Grade AS grade,
       e.EnrollDate AS enroll_date, e.DropDate AS drop_date
FROM Enrollment e
JOIN Section s ON s.SectionID = e.SectionID
JOIN Course c  ON c.CourseCode = s.CourseCode
JOIN Term t    ON t.TermID = s.TermID
WHERE e.StudentID = %s
ORDER BY t.StartDate, s.CourseCode
"""

SCHEDULE_SQL = """
SELECT m.DayOfWeek AS day_of_week, m.StartTime AS start_time, m.EndTime AS end_time,
       s.SectionID AS section_id, s.CourseCode AS course_code, c.Title AS title,
       s.SectionNumber AS section_number, r.Building || ' ' || r.RoomNumber AS room,
       COALESCE(i.FirstName || ' ' || i.LastName, 'TBA') AS instructor
FROM Enrollment e
JOIN Section s        ON s.SectionID = e.SectionID
JOIN Course c         ON c.CourseCode = s.CourseCode
JOIN SectionMeeting m ON m.SectionID = s.SectionID
JOIN Room r           ON r.RoomID = m.RoomID
LEFT JOIN Instructor i ON i.InstructorID = s.InstructorID
WHERE e.StudentID = %s AND s.TermID = %s AND e.Status = 'Enrolled'
ORDER BY array_position(ARRAY['Mon','Tue','Wed','Thu','Fri'], m.DayOfWeek::text), m.StartTime
"""


@router.get("/profile", summary="My student record")
def my_profile(user=Depends(student_only)):
    return fetch_one_or_404("""
        SELECT s.StudentID AS student_id, s.FirstName AS first_name, s.LastName AS last_name,
               s.Email AS email, s.Phone AS phone, s.YearLevel AS year_level,
               s.MajorDeptID AS major_dept_id, d.DeptName AS major
        FROM Student s LEFT JOIN Department d ON d.DeptID = s.MajorDeptID
        WHERE s.StudentID = %s
        """, (user["linked_id"],), "Student")


@router.get("/schedule", summary="My weekly schedule for a term (Use case 06)")
def my_schedule(term_id: str, user=Depends(student_only)):
    return fetch_all(SCHEDULE_SQL, (user["linked_id"], term_id))


@router.get("/enrollments", summary="My courses: current, dropped and completed with grades")
def my_enrollments(user=Depends(student_only)):
    return fetch_all(ENROLLMENTS_SQL, (user["linked_id"],))


@router.post("/enrollments", status_code=201, summary="Register for a section (Use case 04)")
def register(body: RegisterRequest, user=Depends(student_only)):
    """All checks (seats, prerequisites, time conflicts, deadline, duplicates)
    are done by the sp_register_student stored procedure. If one fails,
    the response is 400 with the reason, e.g. "Prerequisite not met: COMP 3300"."""
    execute("CALL sp_register_student(%s, %s)", (user["linked_id"], body.section_id))
    return {"message": "Registered successfully",
            "section": fetch_one_or_404(
                "SELECT SectionID AS section_id, SeatsLeft AS seats_left FROM SectionSeats WHERE SectionID = %s",
                (body.section_id,))}


@router.delete("/enrollments/{section_id}", summary="Drop a section (Use case 05)")
def drop(section_id: int, user=Depends(student_only)):
    execute("CALL sp_drop_course(%s, %s)", (user["linked_id"], section_id))
    return {"message": "Course dropped"}
