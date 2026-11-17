-- =====================================================================
-- UniLink  |  File 3: Stored procedures and triggers (FR9)
--
-- Procedures:  sp_register_student  (Use case 04 / 12)
--              sp_drop_course       (Use case 05 / 12)
-- Triggers:    trg_prevent_over_enrollment   (FR9, NFR 5)
--              trg_no_double_booking         (Use case 11 business rule)
--              trg_capacity_not_below_enrolled (Use case 11 business rule)
-- =====================================================================

-- Helper: letter grade -> grade points, so grades can be compared with MinGrade
CREATE OR REPLACE FUNCTION grade_points(g VARCHAR) RETURNS NUMERIC AS $$
    SELECT CASE g
        WHEN 'A+' THEN 4.3 WHEN 'A' THEN 4.0 WHEN 'A-' THEN 3.7
        WHEN 'B+' THEN 3.3 WHEN 'B' THEN 3.0 WHEN 'B-' THEN 2.7
        WHEN 'C+' THEN 2.3 WHEN 'C' THEN 2.0 WHEN 'C-' THEN 1.7
        WHEN 'D+' THEN 1.3 WHEN 'D' THEN 1.0 WHEN 'D-' THEN 0.7
        ELSE 0 END;
$$ LANGUAGE sql IMMUTABLE;

-- View: seats per section, always computed live (FR5)
CREATE OR REPLACE VIEW SectionSeats AS
SELECT s.SectionID, s.CourseCode, s.TermID, s.SectionNumber, s.EnrollmentLimit,
       COUNT(e.EnrollmentID) AS Enrolled,
       s.EnrollmentLimit - COUNT(e.EnrollmentID) AS SeatsLeft
FROM Section s
LEFT JOIN Enrollment e ON e.SectionID = s.SectionID AND e.Status = 'Enrolled'
GROUP BY s.SectionID;

-- ---------------------------------------------------------------------
-- PROCEDURE sp_register_student  (Use case 04, FR4, FR5)
-- Checks every validation rule from Use case 04. If one fails, it raises
-- an error that names the rule, and nothing is saved.
-- p_admin_id is set when an administrator registers a student (Use case 12);
-- admins may register after the deadline.
-- Usage: CALL sp_register_student(110200001, 13);
-- ---------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_register_student(p_student_id INT, p_section_id INT,
                                                p_admin_id INT DEFAULT NULL)
LANGUAGE plpgsql AS $$
DECLARE
    v_section  Section%ROWTYPE;
    v_deadline DATE;
    v_enrolled INT;
    v_missing  TEXT;
    v_conflict TEXT;
BEGIN
    -- Lock the section row: if two students ask for the last seat at the
    -- same moment, the second waits here until the first one finishes (NFR 5)
    SELECT * INTO v_section FROM Section WHERE SectionID = p_section_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Section % does not exist', p_section_id;
    END IF;

    -- Registration must be open
    SELECT AddDropDeadline INTO v_deadline FROM Term WHERE TermID = v_section.TermID;
    IF CURRENT_DATE > v_deadline AND p_admin_id IS NULL THEN
        RAISE EXCEPTION 'Registration closed: the deadline was %', v_deadline;
    END IF;

    -- Rule 1: the section has a free seat
    SELECT COUNT(*) INTO v_enrolled FROM Enrollment
    WHERE SectionID = p_section_id AND Status = 'Enrolled';
    IF v_enrolled >= v_section.EnrollmentLimit THEN
        RAISE EXCEPTION 'Section full';
    END IF;

    -- Rule 2: not already enrolled in this course this term
    IF EXISTS (SELECT 1 FROM Enrollment e JOIN Section s ON s.SectionID = e.SectionID
               WHERE e.StudentID = p_student_id AND e.Status = 'Enrolled'
                 AND s.CourseCode = v_section.CourseCode AND s.TermID = v_section.TermID) THEN
        RAISE EXCEPTION 'Already enrolled in % this term', v_section.CourseCode;
    END IF;

    -- Rule 3: every prerequisite completed with at least the minimum grade
    SELECT string_agg(p.PrereqCourseCode, ', ') INTO v_missing
    FROM Prerequisite p
    WHERE p.CourseCode = v_section.CourseCode
      AND NOT EXISTS (SELECT 1 FROM Enrollment e JOIN Section s ON s.SectionID = e.SectionID
                      WHERE e.StudentID = p_student_id AND e.Status = 'Completed'
                        AND s.CourseCode = p.PrereqCourseCode
                        AND grade_points(e.Grade) >= grade_points(p.MinGrade));
    IF v_missing IS NOT NULL THEN
        RAISE EXCEPTION 'Prerequisite not met: %', v_missing;
    END IF;

    -- Rule 4: no time overlap with the student's other classes this term
    SELECT s2.CourseCode || ' on ' || m2.DayOfWeek || ' ' || to_char(m2.StartTime, 'HH24:MI')
    INTO v_conflict
    FROM SectionMeeting m1
    JOIN SectionMeeting m2 ON m2.DayOfWeek = m1.DayOfWeek
                          AND m1.StartTime < m2.EndTime AND m2.StartTime < m1.EndTime
    JOIN Section s2   ON s2.SectionID = m2.SectionID
    JOIN Enrollment e ON e.SectionID = s2.SectionID
    WHERE m1.SectionID = p_section_id
      AND s2.TermID = v_section.TermID
      AND e.StudentID = p_student_id AND e.Status = 'Enrolled'
    LIMIT 1;
    IF v_conflict IS NOT NULL THEN
        RAISE EXCEPTION 'Time conflict with %', v_conflict;
    END IF;

    -- All rules passed: create the enrollment
    -- (or re-activate it if the student dropped this section earlier)
    INSERT INTO Enrollment (StudentID, SectionID, Status, ProcessedByAdminID)
    VALUES (p_student_id, p_section_id, 'Enrolled', p_admin_id)
    ON CONFLICT (StudentID, SectionID) DO UPDATE
        SET Status = 'Enrolled', DropDate = NULL, EnrollDate = CURRENT_TIMESTAMP,
            ProcessedByAdminID = p_admin_id;

    RAISE NOTICE 'Registered student % in % section %. Seats left: %',
        p_student_id, v_section.CourseCode, v_section.SectionNumber,
        v_section.EnrollmentLimit - v_enrolled - 1;
END;
$$;

-- ---------------------------------------------------------------------
-- PROCEDURE sp_drop_course  (Use case 05, FR5)
-- Marks the enrollment Dropped (kept as history) which frees the seat.
-- Rejected after the add/drop deadline unless an administrator does it.
-- Usage: CALL sp_drop_course(110200001, 15);
-- ---------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_drop_course(p_student_id INT, p_section_id INT,
                                           p_admin_id INT DEFAULT NULL)
LANGUAGE plpgsql AS $$
DECLARE
    v_deadline DATE;
BEGIN
    SELECT t.AddDropDeadline INTO v_deadline
    FROM Section s JOIN Term t ON t.TermID = s.TermID
    WHERE s.SectionID = p_section_id;

    IF CURRENT_DATE > v_deadline AND p_admin_id IS NULL THEN
        RAISE EXCEPTION 'Drop rejected: the drop deadline was %', v_deadline;
    END IF;

    UPDATE Enrollment
    SET Status = 'Dropped', DropDate = CURRENT_TIMESTAMP, ProcessedByAdminID = p_admin_id
    WHERE StudentID = p_student_id AND SectionID = p_section_id AND Status = 'Enrolled';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Student % is not enrolled in section %', p_student_id, p_section_id;
    END IF;
    RAISE NOTICE 'Dropped student % from section %; seat released', p_student_id, p_section_id;
END;
$$;

-- ---------------------------------------------------------------------
-- TRIGGER 1: prevent over-enrollment (FR9 example)
-- Runs on every new or re-activated enrollment, even ones that do not
-- go through the procedure, and keeps Section.Status as Open/Full.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_prevent_over_enrollment() RETURNS TRIGGER AS $$
DECLARE
    v_limit    INT;
    v_enrolled INT;
BEGIN
    SELECT EnrollmentLimit INTO v_limit FROM Section WHERE SectionID = NEW.SectionID FOR UPDATE;

    SELECT COUNT(*) INTO v_enrolled FROM Enrollment
    WHERE SectionID = NEW.SectionID AND Status = 'Enrolled' AND EnrollmentID <> NEW.EnrollmentID;

    IF v_enrolled >= v_limit THEN
        RAISE EXCEPTION 'Section full: % of % seats taken', v_enrolled, v_limit;
    END IF;

    -- this enrollment takes the last seat -> mark the section Full
    IF v_enrolled + 1 = v_limit THEN
        UPDATE Section SET Status = 'Full' WHERE SectionID = NEW.SectionID;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_over_enrollment
BEFORE INSERT OR UPDATE OF Status ON Enrollment
FOR EACH ROW
WHEN (NEW.Status = 'Enrolled')
EXECUTE FUNCTION fn_prevent_over_enrollment();

-- When someone drops out of a Full section, open it again
CREATE OR REPLACE FUNCTION fn_reopen_section() RETURNS TRIGGER AS $$
BEGIN
    UPDATE Section SET Status = 'Open' WHERE SectionID = NEW.SectionID AND Status = 'Full';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reopen_section
AFTER UPDATE OF Status ON Enrollment
FOR EACH ROW
WHEN (OLD.Status = 'Enrolled' AND NEW.Status = 'Dropped')
EXECUTE FUNCTION fn_reopen_section();

-- ---------------------------------------------------------------------
-- TRIGGER 2: no double-booking (Use case 11 business rule)
-- A room or an instructor cannot be in two places at once in a term.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_no_double_booking() RETURNS TRIGGER AS $$
DECLARE
    v_term       VARCHAR;
    v_instructor INT;
    v_clash      TEXT;
BEGIN
    SELECT TermID, InstructorID INTO v_term, v_instructor
    FROM Section WHERE SectionID = NEW.SectionID;

    -- Any other meeting in the same term, same day, overlapping time,
    -- that uses the same room or the same instructor?
    SELECT s.CourseCode || ' section ' || s.SectionNumber ||
           CASE WHEN m.RoomID = NEW.RoomID THEN ' (same room)' ELSE ' (same instructor)' END
    INTO v_clash
    FROM SectionMeeting m
    JOIN Section s ON s.SectionID = m.SectionID
    WHERE s.TermID = v_term
      AND m.SectionID <> NEW.SectionID
      AND m.DayOfWeek = NEW.DayOfWeek
      AND m.StartTime < NEW.EndTime AND NEW.StartTime < m.EndTime
      AND (m.RoomID = NEW.RoomID OR s.InstructorID = v_instructor)
    LIMIT 1;

    IF v_clash IS NOT NULL THEN
        RAISE EXCEPTION 'Double-booked: clashes with %', v_clash;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_no_double_booking
BEFORE INSERT OR UPDATE ON SectionMeeting
FOR EACH ROW
EXECUTE FUNCTION fn_no_double_booking();

-- ---------------------------------------------------------------------
-- TRIGGER 3: capacity cannot be reduced below current enrollment
-- (Use case 11 business rule)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_capacity_check() RETURNS TRIGGER AS $$
DECLARE
    v_enrolled INT;
BEGIN
    SELECT COUNT(*) INTO v_enrolled FROM Enrollment
    WHERE SectionID = NEW.SectionID AND Status = 'Enrolled';

    IF NEW.EnrollmentLimit < v_enrolled THEN
        RAISE EXCEPTION 'Cannot set capacity to %: % students already enrolled',
            NEW.EnrollmentLimit, v_enrolled;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_capacity_not_below_enrolled
BEFORE UPDATE OF EnrollmentLimit ON Section
FOR EACH ROW
EXECUTE FUNCTION fn_capacity_check();
