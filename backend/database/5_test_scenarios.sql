-- =====================================================================
-- UniLink  |  File 5: Testing the procedures and triggers
-- Acts out the scenarios from the Requirements Analysis Document.
-- Expected failures are caught so the script keeps going and prints
-- the error message. Everything is rolled back at the end, so the
-- script can be run again.
-- =====================================================================
BEGIN;

-- Scenario 1: Aisha registers for COMP 3150 section 02 (12 seats left)
CALL sp_register_student(110200001, 13);
SELECT CourseCode, SectionNumber, Enrolled, SeatsLeft FROM SectionSeats WHERE SectionID = 13;  -- 11 left

-- Scenario 2: Marcus is rejected, then picks a section that fits
DO $$ BEGIN CALL sp_register_student(110200002, 16);          -- COMP 4300: COMP 3300 not completed
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Rejected: %', SQLERRM; END $$;

DO $$ BEGIN CALL sp_register_student(110200002, 12);          -- COMP 3150-01 clashes with COMP 3340 on Tue
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Rejected: %', SQLERRM; END $$;

CALL sp_register_student(110200002, 13);                      -- COMP 3150-02 fits

-- Prerequisite taken but grade too low: Priya has a D in COMP 2540 (needs C)
DO $$ BEGIN CALL sp_register_student(110200003, 13);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Rejected: %', SQLERRM; END $$;

-- Already enrolled in the course this term (Aisha tries section 01 too)
DO $$ BEGIN CALL sp_register_student(110200001, 12);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Rejected: %', SQLERRM; END $$;

-- Scenario 3: two students, one seat left in COMP 4300
CALL sp_register_student(110200011, 16);                      -- Fatou gets the last seat
DO $$ BEGIN CALL sp_register_student(110200012, 16);          -- Jack: Section full
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Rejected: %', SQLERRM; END $$;
SELECT SectionID, Status FROM Section WHERE SectionID = 16;  -- Full

-- Trigger 1 also stops a direct INSERT that skips the procedure
DO $$ BEGIN INSERT INTO Enrollment (StudentID, SectionID) VALUES (110200012, 16);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Rejected: %', SQLERRM; END $$;

-- Use case 05: drop a course
CALL sp_drop_course(110200001, 15);                           -- Winter 2027: allowed
DO $$ BEGIN CALL sp_drop_course(110200001, 9);                -- Fall 2026: deadline passed
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Rejected: %', SQLERRM; END $$;
CALL sp_drop_course(110200001, 9, 9001);                      -- an administrator can still do it

-- Dropping from a Full section re-opens it
CALL sp_drop_course(110200009, 16);
SELECT SectionID, Status FROM Section WHERE SectionID = 16;  -- Open

-- Use case 12: the admin drop above was a mistake; the admin re-registers
-- Aisha in her Fall 2026 section even though the deadline has passed
CALL sp_register_student(110200001, 9, 9001);
SELECT StudentID, SectionID, Status, ProcessedByAdminID FROM Enrollment
WHERE StudentID = 110200001 AND SectionID = 9;

-- Scenario 5 / Use case 11: admin creates a section; instructor clash is refused
INSERT INTO Section (CourseCode, TermID, SectionNumber, InstructorID, EnrollmentLimit)
VALUES ('COMP 3540', 'W2027', 2, 5003, 35);                   -- Dr. Mehta
DO $$ BEGIN
    INSERT INTO SectionMeeting (SectionID, DayOfWeek, StartTime, EndTime, RoomID)
    VALUES (currval('section_sectionid_seq'), 'Mon', '11:30', '12:50', 1);  -- he teaches COMP 4300 then
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Rejected: %', SQLERRM; END $$;
INSERT INTO SectionMeeting (SectionID, DayOfWeek, StartTime, EndTime, RoomID)
VALUES (currval('section_sectionid_seq'), 'Mon', '16:00', '17:20', 1);      -- another time works

-- Room double-booking: Essex Hall 186 is used by COMP 3150-01 on Tue 11:30
DO $$ BEGIN
    INSERT INTO SectionMeeting (SectionID, DayOfWeek, StartTime, EndTime, RoomID)
    VALUES (15, 'Tue', '12:00', '13:00', 3);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Rejected: %', SQLERRM; END $$;

-- Trigger 3: capacity cannot go below current enrollment
DO $$ BEGIN UPDATE Section SET EnrollmentLimit = 2 WHERE SectionID = 13;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Rejected: %', SQLERRM; END $$;

ROLLBACK;
