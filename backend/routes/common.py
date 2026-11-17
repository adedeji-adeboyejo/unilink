"""
Endpoints any logged-in user can use: course search and lookup lists
(Use cases 02 and 03). The lookup lists fill the GUI's dropdowns.
"""
from fastapi import APIRouter, Depends

from auth import current_user
from db import fetch_all, fetch_one_or_404

router = APIRouter(tags=["Browse (all roles)"], dependencies=[Depends(current_user)])

# Shared SELECT for sections, used by search and by the instructor / admin pages
SECTION_SELECT = """
SELECT s.SectionID      AS section_id,
       s.CourseCode     AS course_code,
       c.Title          AS title,
       c.Credits        AS credits,
       c.DeptID         AS dept_id,
       s.TermID         AS term_id,
       s.SectionNumber  AS section_number,
       s.InstructorID   AS instructor_id,
       COALESCE(i.FirstName || ' ' || i.LastName, 'TBA') AS instructor,
       (SELECT string_agg(m.DayOfWeek || ' ' || to_char(m.StartTime, 'HH24:MI')
                          || '-' || to_char(m.EndTime, 'HH24:MI'), ', '
                          ORDER BY array_position(ARRAY['Mon','Tue','Wed','Thu','Fri'], m.DayOfWeek::text))
        FROM SectionMeeting m WHERE m.SectionID = s.SectionID) AS schedule,
       ss.EnrollmentLimit AS enrollment_limit,
       ss.Enrolled        AS enrolled,
       ss.SeatsLeft       AS seats_left,
       s.Status           AS status
FROM Section s
JOIN Course c        ON c.CourseCode = s.CourseCode
JOIN SectionSeats ss ON ss.SectionID = s.SectionID
LEFT JOIN Instructor i ON i.InstructorID = s.InstructorID
"""


@router.get("/sections", summary="Search sections (Use case 02)")
def search_sections(term_id: str | None = None, keyword: str | None = None,
                    dept_id: str | None = None, instructor: str | None = None,
                    day: str | None = None):
    """All filters are optional. `keyword` matches course code or title,
    `instructor` matches part of the instructor's name, `day` is Mon..Fri."""
    return fetch_all(SECTION_SELECT + """
        WHERE (%(term)s::text IS NULL OR s.TermID = %(term)s)
          AND (%(kw)s::text IS NULL OR s.CourseCode ILIKE '%%' || %(kw)s || '%%'
                                    OR c.Title ILIKE '%%' || %(kw)s || '%%')
          AND (%(dept)s::text IS NULL OR c.DeptID = %(dept)s)
          AND (%(instr)s::text IS NULL OR i.FirstName || ' ' || i.LastName ILIKE '%%' || %(instr)s || '%%')
          AND (%(day)s::text IS NULL OR EXISTS (SELECT 1 FROM SectionMeeting m
                                               WHERE m.SectionID = s.SectionID AND m.DayOfWeek = %(day)s))
        ORDER BY s.CourseCode, s.SectionNumber
        """, {"term": term_id, "kw": keyword, "dept": dept_id, "instr": instructor, "day": day})


@router.get("/sections/{section_id}", summary="Section details (Use case 03)")
def section_details(section_id: int):
    """Section info plus its weekly meetings and the course's prerequisites."""
    section = fetch_one_or_404(SECTION_SELECT + "WHERE s.SectionID = %s",
                               (section_id,), "Section")
    section["meetings"] = fetch_all("""
        SELECT m.MeetingID AS meeting_id, m.DayOfWeek AS day_of_week,
               m.StartTime AS start_time, m.EndTime AS end_time,
               m.RoomID AS room_id, r.Building || ' ' || r.RoomNumber AS room
        FROM SectionMeeting m JOIN Room r ON r.RoomID = m.RoomID
        WHERE m.SectionID = %s
        ORDER BY array_position(ARRAY['Mon','Tue','Wed','Thu','Fri'], m.DayOfWeek::text), m.StartTime
        """, (section_id,))
    section["prerequisites"] = fetch_all("""
        SELECT p.PrereqCourseCode AS course_code, c.Title AS title, p.MinGrade AS min_grade
        FROM Prerequisite p JOIN Course c ON c.CourseCode = p.PrereqCourseCode
        WHERE p.CourseCode = %s ORDER BY 1
        """, (section["course_code"],))
    return section


@router.get("/courses", summary="Course catalogue")
def list_courses(dept_id: str | None = None):
    return fetch_all("""
        SELECT c.CourseCode AS course_code, c.Title AS title, c.Description AS description,
               c.Credits AS credits, c.DeptID AS dept_id,
               COALESCE((SELECT string_agg(p.PrereqCourseCode || ' (min ' || p.MinGrade || ')', ', ')
                         FROM Prerequisite p WHERE p.CourseCode = c.CourseCode), '') AS prerequisites
        FROM Course c
        WHERE %(dept)s::text IS NULL OR c.DeptID = %(dept)s
        ORDER BY c.CourseCode
        """, {"dept": dept_id})


@router.get("/terms", summary="List terms (for dropdowns)")
def list_terms():
    return fetch_all("""
        SELECT TermID AS term_id, TermName AS term_name, StartDate AS start_date,
               EndDate AS end_date, AddDropDeadline AS add_drop_deadline,
               CURRENT_DATE <= AddDropDeadline AS registration_open
        FROM Term ORDER BY StartDate
        """)


@router.get("/departments", summary="List departments (for dropdowns)")
def list_departments():
    return fetch_all("SELECT DeptID AS dept_id, DeptName AS dept_name FROM Department ORDER BY 1")


@router.get("/rooms", summary="List rooms (for dropdowns)")
def list_rooms():
    return fetch_all("""
        SELECT RoomID AS room_id, Building || ' ' || RoomNumber AS room, Capacity AS capacity
        FROM Room ORDER BY Building, RoomNumber
        """)


@router.get("/instructors", summary="List instructors (for dropdowns)")
def list_instructors():
    return fetch_all("""
        SELECT InstructorID AS instructor_id, FirstName || ' ' || LastName AS name, DeptID AS dept_id
        FROM Instructor ORDER BY LastName, FirstName
        """)
