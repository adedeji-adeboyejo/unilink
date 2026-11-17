-- =====================================================================
-- UniLink  |  File 4: Key queries (one or more per use case)
-- =====================================================================

-- Q1. Search courses and sections (Use case 02): keyword "database", Winter 2027
SELECT s.SectionID, c.CourseCode, c.Title, s.SectionNumber,
       i.FirstName || ' ' || i.LastName AS Instructor, ss.SeatsLeft, s.Status
FROM Section s
JOIN Course c       ON c.CourseCode = s.CourseCode
JOIN SectionSeats ss ON ss.SectionID = s.SectionID
LEFT JOIN Instructor i ON i.InstructorID = s.InstructorID
WHERE s.TermID = 'W2027'
  AND (c.Title ILIKE '%database%' OR c.CourseCode ILIKE '%database%')
ORDER BY c.CourseCode, s.SectionNumber;

-- Q2. Course details: prerequisites, schedule, instructor, seats (Use case 03)
SELECT c.CourseCode, c.Title, s.SectionNumber,
       i.FirstName || ' ' || i.LastName AS Instructor,
       m.DayOfWeek, m.StartTime, m.EndTime, r.Building || ' ' || r.RoomNumber AS Room,
       ss.SeatsLeft,
       (SELECT string_agg(p.PrereqCourseCode || ' (min ' || p.MinGrade || ')', ', ')
        FROM Prerequisite p WHERE p.CourseCode = c.CourseCode) AS Prerequisites
FROM Section s
JOIN Course c          ON c.CourseCode = s.CourseCode
JOIN SectionSeats ss   ON ss.SectionID = s.SectionID
JOIN SectionMeeting m  ON m.SectionID = s.SectionID
JOIN Room r            ON r.RoomID = m.RoomID
LEFT JOIN Instructor i ON i.InstructorID = s.InstructorID
WHERE s.SectionID = 13;

-- Q3. A student's weekly schedule (Use case 06): Marcus, Winter 2027
SELECT m.DayOfWeek, m.StartTime, m.EndTime, s.CourseCode, s.SectionNumber,
       r.Building || ' ' || r.RoomNumber AS Room
FROM Enrollment e
JOIN Section s        ON s.SectionID = e.SectionID
JOIN SectionMeeting m ON m.SectionID = s.SectionID
JOIN Room r           ON r.RoomID = m.RoomID
WHERE e.StudentID = 110200002 AND s.TermID = 'W2027' AND e.Status = 'Enrolled'
ORDER BY array_position(ARRAY['Mon','Tue','Wed','Thu','Fri'], m.DayOfWeek::text), m.StartTime;

-- Q4. Sections an instructor teaches in a term (Use case 07): Dr. Okafor, Winter 2027
SELECT s.SectionID, s.CourseCode, s.SectionNumber, s.EnrollmentLimit, ss.Enrolled, ss.SeatsLeft
FROM Section s
JOIN SectionSeats ss ON ss.SectionID = s.SectionID
WHERE s.InstructorID = 5001 AND s.TermID = 'W2027'
ORDER BY s.CourseCode, s.SectionNumber;

-- Q5. Class list for one of the instructor's own sections (Use case 08)
--     (the InstructorID condition stops instructors seeing other sections)
SELECT st.StudentID, st.FirstName, st.LastName, st.Email
FROM Enrollment e
JOIN Student st ON st.StudentID = e.StudentID
JOIN Section s  ON s.SectionID = e.SectionID
WHERE e.SectionID = 13 AND s.InstructorID = 5001 AND e.Status = 'Enrolled'
ORDER BY st.LastName;

-- Q6. Enrollment report per section (Use case 13): Winter 2027
SELECT ss.CourseCode, ss.SectionNumber, ss.EnrollmentLimit, ss.Enrolled,
       ROUND(100.0 * ss.Enrolled / ss.EnrollmentLimit, 1) AS PercentFull
FROM SectionSeats ss
WHERE ss.TermID = 'W2027'
ORDER BY PercentFull DESC;

-- Q7. Full sections that may need another section (Use case 13)
SELECT CourseCode, SectionNumber, TermID, EnrollmentLimit, Enrolled
FROM SectionSeats
WHERE SeatsLeft = 0 AND TermID IN ('F2026', 'W2027');

-- Q8. Registration history for a student, including drops (Use case 13)
SELECT s.TermID, s.CourseCode, s.SectionNumber, e.Status, e.Grade, e.EnrollDate, e.DropDate,
       a.FirstName || ' ' || a.LastName AS ProcessedBy
FROM Enrollment e
JOIN Section s ON s.SectionID = e.SectionID
LEFT JOIN Administrator a ON a.AdminID = e.ProcessedByAdminID
WHERE e.StudentID = 110200001
ORDER BY e.EnrollDate;

-- Q9. GPA for every student with completed courses (aggregation)
SELECT st.StudentID, st.FirstName || ' ' || st.LastName AS Student, st.YearLevel,
       ROUND(SUM(grade_points(e.Grade) * c.Credits) / SUM(c.Credits), 2) AS GPA
FROM Student st
JOIN Enrollment e ON e.StudentID = st.StudentID AND e.Status = 'Completed'
JOIN Section s    ON s.SectionID = e.SectionID
JOIN Course c     ON c.CourseCode = s.CourseCode
GROUP BY st.StudentID
ORDER BY GPA DESC;

-- Q10. Full prerequisite chain for COMP 4150 (recursive query)
WITH RECURSIVE chain AS (
    SELECT PrereqCourseCode, MinGrade, 1 AS Level
    FROM Prerequisite WHERE CourseCode = 'COMP 4150'
    UNION ALL
    SELECT p.PrereqCourseCode, p.MinGrade, chain.Level + 1
    FROM Prerequisite p JOIN chain ON p.CourseCode = chain.PrereqCourseCode
)
SELECT Level, PrereqCourseCode, MinGrade FROM chain ORDER BY Level;

-- Q11. Students eligible to take COMP 4300 (have every prerequisite at the minimum grade)
SELECT st.StudentID, st.FirstName || ' ' || st.LastName AS Student
FROM Student st
WHERE NOT EXISTS (
    SELECT 1 FROM Prerequisite p
    WHERE p.CourseCode = 'COMP 4300'
      AND NOT EXISTS (
          SELECT 1 FROM Enrollment e JOIN Section s ON s.SectionID = e.SectionID
          WHERE e.StudentID = st.StudentID AND e.Status = 'Completed'
            AND s.CourseCode = p.PrereqCourseCode
            AND grade_points(e.Grade) >= grade_points(p.MinGrade)));
