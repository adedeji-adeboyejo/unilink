"""
Instructor endpoints (Use cases 07, 08).
Instructors only see sections they teach.
"""
from fastapi import APIRouter, Depends, HTTPException

from auth import require_role
from db import fetch_all, fetch_one
from routes.common import SECTION_SELECT

router = APIRouter(prefix="/instructor", tags=["Instructor"])
instructor_only = require_role("Instructor")


@router.get("/sections", summary="Sections I teach (Use case 07)")
def my_sections(term_id: str | None = None, user=Depends(instructor_only)):
    return fetch_all(SECTION_SELECT + """
        WHERE s.InstructorID = %s AND (%s::text IS NULL OR s.TermID = %s)
        ORDER BY s.TermID DESC, s.CourseCode, s.SectionNumber
        """, (user["linked_id"], term_id, term_id))


@router.get("/sections/{section_id}/students", summary="Class list for one of my sections (Use case 08)")
def class_list(section_id: int, user=Depends(instructor_only)):
    owner = fetch_one("SELECT InstructorID FROM Section WHERE SectionID = %s", (section_id,))
    if owner is None:
        raise HTTPException(404, "Section not found")
    if owner["instructorid"] != user["linked_id"]:
        raise HTTPException(403, "You can only view class lists for sections you teach")

    # only name, student number and email are shown to instructors
    return fetch_all("""
        SELECT st.StudentID AS student_id, st.FirstName AS first_name,
               st.LastName AS last_name, st.Email AS email
        FROM Enrollment e JOIN Student st ON st.StudentID = e.StudentID
        WHERE e.SectionID = %s AND e.Status = 'Enrolled'
        ORDER BY st.LastName, st.FirstName
        """, (section_id,))
