"""
Administrator endpoints: full Create / Read / Update / Delete on
students, instructors, courses, prerequisites, sections and meetings
(Use cases 09, 10, 11), registration on a student's behalf (Use case 12)
and reports (Use case 13).

Business rules stay in the database: e.g. deleting a student who has
enrollments is refused by the foreign key (409), and double-booking a
room is refused by a trigger (400). The backend passes the message on.
"""
from datetime import date, time

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth import require_role
from db import connect, execute, execute_or_404, fetch_all, fetch_one_or_404
from routes.common import SECTION_SELECT
from routes.student import ENROLLMENTS_SQL

router = APIRouter(prefix="/admin", tags=["Admin"], dependencies=[Depends(require_role("Admin"))])


# ============================== Students ==============================
class StudentIn(BaseModel):
    first_name: str
    last_name: str
    email: str
    phone: str | None = None
    date_of_birth: date | None = None
    year_level: int = Field(1, ge=1, le=6)
    major_dept_id: str | None = None


class NewStudent(StudentIn):
    student_id: int
    password: str = Field(min_length=8, description="Password for the student's login")


STUDENT_SELECT = """
SELECT StudentID AS student_id, FirstName AS first_name, LastName AS last_name, Email AS email,
       Phone AS phone, DateOfBirth AS date_of_birth, YearLevel AS year_level,
       MajorDeptID AS major_dept_id
FROM Student
"""


@router.get("/students", summary="List / search students")
def list_students(search: str | None = None):
    return fetch_all(STUDENT_SELECT + """
        WHERE %(q)s::text IS NULL OR FirstName || ' ' || LastName ILIKE '%%' || %(q)s || '%%'
           OR StudentID::text LIKE %(q)s || '%%'
        ORDER BY LastName, FirstName
        """, {"q": search})


@router.get("/students/{student_id}", summary="Get one student")
def get_student(student_id: int):
    return fetch_one_or_404(STUDENT_SELECT + "WHERE StudentID = %s", (student_id,), "Student")


@router.post("/students", status_code=201, summary="Create a student and their login")
def create_student(s: NewStudent):
    with connect() as conn:   # both inserts succeed together or not at all
        conn.execute("""
            INSERT INTO Student (StudentID, FirstName, LastName, Email, Phone, DateOfBirth, YearLevel, MajorDeptID)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (s.student_id, s.first_name, s.last_name, s.email, s.phone,
                  s.date_of_birth, s.year_level, s.major_dept_id))
        conn.execute("""
            INSERT INTO UserAccount (Username, PasswordHash, Role, LinkedID)
            VALUES (lower(split_part(%s, '@', 1)), crypt(%s, gen_salt('bf')), 'Student', %s)
            """, (s.email, s.password, s.student_id))
    return {"message": "Student created", "username": s.email.split("@")[0].lower()}


@router.put("/students/{student_id}", summary="Update a student")
def update_student(student_id: int, s: StudentIn):
    execute_or_404("""
        UPDATE Student SET FirstName = %s, LastName = %s, Email = %s, Phone = %s,
               DateOfBirth = %s, YearLevel = %s, MajorDeptID = %s
        WHERE StudentID = %s
        """, (s.first_name, s.last_name, s.email, s.phone, s.date_of_birth,
              s.year_level, s.major_dept_id, student_id), "Student")
    return {"message": "Student updated"}


@router.delete("/students/{student_id}", summary="Delete a student (only if they have no enrollments)")
def delete_student(student_id: int):
    with connect() as conn:
        conn.execute("DELETE FROM UserAccount WHERE Role = 'Student' AND LinkedID = %s", (student_id,))
        if conn.execute("DELETE FROM Student WHERE StudentID = %s", (student_id,)).rowcount == 0:
            raise HTTPException(404, "Student not found")
    return {"message": "Student deleted"}


@router.get("/students/{student_id}/enrollments", summary="A student's registration history")
def student_enrollments(student_id: int):
    return fetch_all(ENROLLMENTS_SQL, (student_id,))


# ============================= Instructors =============================
class InstructorIn(BaseModel):
    first_name: str
    last_name: str
    email: str
    office_location: str | None = None
    dept_id: str


class NewInstructor(InstructorIn):
    instructor_id: int
    password: str = Field(min_length=8)


INSTRUCTOR_SELECT = """
SELECT InstructorID AS instructor_id, FirstName AS first_name, LastName AS last_name,
       Email AS email, OfficeLocation AS office_location, DeptID AS dept_id
FROM Instructor
"""


@router.get("/instructors", summary="List instructors")
def list_instructors():
    return fetch_all(INSTRUCTOR_SELECT + "ORDER BY LastName, FirstName")


@router.get("/instructors/{instructor_id}", summary="Get one instructor")
def get_instructor(instructor_id: int):
    return fetch_one_or_404(INSTRUCTOR_SELECT + "WHERE InstructorID = %s", (instructor_id,), "Instructor")


@router.post("/instructors", status_code=201, summary="Create an instructor and their login")
def create_instructor(i: NewInstructor):
    with connect() as conn:
        conn.execute("""
            INSERT INTO Instructor (InstructorID, FirstName, LastName, Email, OfficeLocation, DeptID)
            VALUES (%s, %s, %s, %s, %s, %s)
            """, (i.instructor_id, i.first_name, i.last_name, i.email, i.office_location, i.dept_id))
        conn.execute("""
            INSERT INTO UserAccount (Username, PasswordHash, Role, LinkedID)
            VALUES (lower(split_part(%s, '@', 1)), crypt(%s, gen_salt('bf')), 'Instructor', %s)
            """, (i.email, i.password, i.instructor_id))
    return {"message": "Instructor created", "username": i.email.split("@")[0].lower()}


@router.put("/instructors/{instructor_id}", summary="Update an instructor")
def update_instructor(instructor_id: int, i: InstructorIn):
    execute_or_404("""
        UPDATE Instructor SET FirstName = %s, LastName = %s, Email = %s, OfficeLocation = %s, DeptID = %s
        WHERE InstructorID = %s
        """, (i.first_name, i.last_name, i.email, i.office_location, i.dept_id, instructor_id), "Instructor")
    return {"message": "Instructor updated"}


@router.delete("/instructors/{instructor_id}", summary="Delete an instructor (their sections become unassigned)")
def delete_instructor(instructor_id: int):
    with connect() as conn:
        conn.execute("DELETE FROM UserAccount WHERE Role = 'Instructor' AND LinkedID = %s", (instructor_id,))
        if conn.execute("DELETE FROM Instructor WHERE InstructorID = %s", (instructor_id,)).rowcount == 0:
            raise HTTPException(404, "Instructor not found")
    return {"message": "Instructor deleted"}


# =============================== Courses ===============================
class CourseIn(BaseModel):
    title: str
    description: str | None = None
    credits: float = Field(3.0, gt=0)
    dept_id: str


class NewCourse(CourseIn):
    course_code: str


class PrerequisiteIn(BaseModel):
    prereq_course_code: str
    min_grade: str = "D-"


@router.get("/courses/{course_code}", summary="Get one course")
def get_course(course_code: str):
    return fetch_one_or_404("""
        SELECT CourseCode AS course_code, Title AS title, Description AS description,
               Credits AS credits, DeptID AS dept_id
        FROM Course WHERE CourseCode = %s
        """, (course_code,), "Course")


@router.post("/courses", status_code=201, summary="Create a course")
def create_course(c: NewCourse):
    execute("INSERT INTO Course (CourseCode, Title, Description, Credits, DeptID) VALUES (%s, %s, %s, %s, %s)",
            (c.course_code, c.title, c.description, c.credits, c.dept_id))
    return {"message": "Course created"}


@router.put("/courses/{course_code}", summary="Update a course")
def update_course(course_code: str, c: CourseIn):
    execute_or_404("UPDATE Course SET Title = %s, Description = %s, Credits = %s, DeptID = %s WHERE CourseCode = %s",
                   (c.title, c.description, c.credits, c.dept_id, course_code), "Course")
    return {"message": "Course updated"}


@router.delete("/courses/{course_code}", summary="Delete a course (only if it has no sections)")
def delete_course(course_code: str):
    execute_or_404("DELETE FROM Course WHERE CourseCode = %s", (course_code,), "Course")
    return {"message": "Course deleted"}


@router.post("/courses/{course_code}/prerequisites", status_code=201, summary="Add a prerequisite")
def add_prerequisite(course_code: str, p: PrerequisiteIn):
    execute("INSERT INTO Prerequisite (CourseCode, PrereqCourseCode, MinGrade) VALUES (%s, %s, %s)",
            (course_code, p.prereq_course_code, p.min_grade))
    return {"message": "Prerequisite added"}


@router.delete("/courses/{course_code}/prerequisites/{prereq_code}", summary="Remove a prerequisite")
def remove_prerequisite(course_code: str, prereq_code: str):
    execute_or_404("DELETE FROM Prerequisite WHERE CourseCode = %s AND PrereqCourseCode = %s",
                   (course_code, prereq_code), "Prerequisite")
    return {"message": "Prerequisite removed"}


# ============================== Sections ==============================
class MeetingIn(BaseModel):
    day_of_week: str = Field(pattern="^(Mon|Tue|Wed|Thu|Fri)$")
    start_time: time
    end_time: time
    room_id: int


class NewSection(BaseModel):
    course_code: str
    term_id: str
    section_number: int
    instructor_id: int | None = None
    enrollment_limit: int = Field(gt=0)
    meetings: list[MeetingIn] = []


class SectionUpdate(BaseModel):
    instructor_id: int | None = None
    enrollment_limit: int = Field(gt=0)
    status: str | None = Field(None, pattern="^(Open|Full|Closed)$")   # leave out to keep the current status


@router.get("/sections", summary="List sections in a term, with seats")
def list_sections(term_id: str | None = None):
    return fetch_all(SECTION_SELECT + """
        WHERE %s::text IS NULL OR s.TermID = %s
        ORDER BY s.TermID, s.CourseCode, s.SectionNumber
        """, (term_id, term_id))


@router.post("/sections", status_code=201, summary="Create a section with its weekly meetings (Use case 11)")
def create_section(s: NewSection):
    """Section and meetings are saved together. If a meeting double-books a
    room or the instructor, the trigger refuses it and nothing is saved."""
    with connect() as conn:
        row = conn.execute("""
            INSERT INTO Section (CourseCode, TermID, SectionNumber, InstructorID, EnrollmentLimit)
            VALUES (%s, %s, %s, %s, %s) RETURNING SectionID AS section_id
            """, (s.course_code, s.term_id, s.section_number, s.instructor_id, s.enrollment_limit)).fetchone()
        for m in s.meetings:
            conn.execute("""
                INSERT INTO SectionMeeting (SectionID, DayOfWeek, StartTime, EndTime, RoomID)
                VALUES (%s, %s, %s, %s, %s)
                """, (row["section_id"], m.day_of_week, m.start_time, m.end_time, m.room_id))
    return {"message": "Section created", "section_id": row["section_id"]}


@router.put("/sections/{section_id}", summary="Change instructor, capacity or status")
def update_section(section_id: int, s: SectionUpdate):
    execute_or_404("UPDATE Section SET InstructorID = %s, EnrollmentLimit = %s, Status = COALESCE(%s, Status) WHERE SectionID = %s",
                   (s.instructor_id, s.enrollment_limit, s.status, section_id), "Section")
    return {"message": "Section updated"}


@router.delete("/sections/{section_id}", summary="Delete a section (only if nobody has enrolled)")
def delete_section(section_id: int):
    execute_or_404("DELETE FROM Section WHERE SectionID = %s", (section_id,), "Section")
    return {"message": "Section deleted"}


@router.post("/sections/{section_id}/meetings", status_code=201, summary="Add a meeting time to a section")
def add_meeting(section_id: int, m: MeetingIn):
    execute("INSERT INTO SectionMeeting (SectionID, DayOfWeek, StartTime, EndTime, RoomID) VALUES (%s, %s, %s, %s, %s)",
            (section_id, m.day_of_week, m.start_time, m.end_time, m.room_id))
    return {"message": "Meeting added"}


@router.delete("/meetings/{meeting_id}", summary="Remove a meeting time")
def delete_meeting(meeting_id: int):
    execute_or_404("DELETE FROM SectionMeeting WHERE MeetingID = %s", (meeting_id,), "Meeting")
    return {"message": "Meeting removed"}


# ===================== Registration on a student's behalf =====================
class AdminEnrollment(BaseModel):
    student_id: int
    section_id: int


@router.post("/enrollments", status_code=201, summary="Register a student (Use case 12)")
def admin_register(e: AdminEnrollment, user=Depends(require_role("Admin"))):
    """Same checks as a student registration, except the deadline does not apply."""
    execute("CALL sp_register_student(%s, %s, %s)", (e.student_id, e.section_id, user["linked_id"]))
    return {"message": "Student registered"}


@router.delete("/enrollments/{student_id}/{section_id}", summary="Drop a student from a section (Use case 12)")
def admin_drop(student_id: int, section_id: int, user=Depends(require_role("Admin"))):
    execute("CALL sp_drop_course(%s, %s, %s)", (student_id, section_id, user["linked_id"]))
    return {"message": "Student dropped"}


# =============================== Reports ===============================
@router.get("/reports/enrollment", summary="Enrollment per section (Use case 13)")
def enrollment_report(term_id: str):
    return fetch_all("""
        SELECT ss.SectionID AS section_id, ss.CourseCode AS course_code, c.Title AS title,
               ss.SectionNumber AS section_number, ss.EnrollmentLimit AS enrollment_limit,
               ss.Enrolled AS enrolled, ss.SeatsLeft AS seats_left,
               ROUND(100.0 * ss.Enrolled / ss.EnrollmentLimit, 1) AS percent_full
        FROM SectionSeats ss JOIN Course c ON c.CourseCode = ss.CourseCode
        WHERE ss.TermID = %s
        ORDER BY percent_full DESC, ss.CourseCode
        """, (term_id,))


@router.get("/reports/full-sections", summary="Full sections that may need another section (Use case 13)")
def full_sections():
    return fetch_all("""
        SELECT ss.SectionID AS section_id, ss.TermID AS term_id, ss.CourseCode AS course_code,
               ss.SectionNumber AS section_number, ss.EnrollmentLimit AS enrollment_limit, ss.Enrolled AS enrolled
        FROM SectionSeats ss JOIN Term t ON t.TermID = ss.TermID
        WHERE ss.SeatsLeft <= 0 AND t.EndDate >= CURRENT_DATE
        ORDER BY ss.TermID, ss.CourseCode
        """)
