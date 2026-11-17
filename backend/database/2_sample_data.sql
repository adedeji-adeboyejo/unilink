-- =====================================================================
-- UniLink  |  File 2: Sample / test data
--
-- Terms:  Fall 2025 and Winter 2026 are finished (grades on file),
--         Fall 2026 is in progress (add/drop deadline has passed),
--         Winter 2027 is open for registration.
-- Characters from the Requirements Document scenarios:
--         Aisha Khan, Marcus Johnson (students), Dr. Grace Okafor.
-- =====================================================================

INSERT INTO Department VALUES
('COMP', 'School of Computer Science',  'Lambton Tower', '519-253-3000 x3716'),
('MATH', 'Mathematics and Statistics',  'Lambton Tower', '519-253-3000 x3014');

INSERT INTO Student VALUES
(110200001, 'Aisha',  'Khan',     'aisha.khan@uwindsor.ca',     '519-555-0101', '2005-03-14', 3, 'COMP'),
(110200002, 'Marcus', 'Johnson',  'marcus.johnson@uwindsor.ca', '519-555-0102', '2005-07-22', 3, 'COMP'),
(110200003, 'Priya',  'Patel',    'priya.patel@uwindsor.ca',    '519-555-0103', '2005-11-02', 3, 'COMP'),
(110200004, 'Jacob',  'Fraser',   'jacob.fraser@uwindsor.ca',   '519-555-0104', '2005-01-30', 3, 'COMP'),
(110200005, 'Amara',  'Nwosu',    'amara.nwosu@uwindsor.ca',    '519-555-0105', '2005-09-09', 3, 'MATH'),
(110200006, 'Liam',   'Chen',     'liam.chen@uwindsor.ca',      '519-555-0106', '2006-04-18', 2, 'COMP'),
(110200007, 'Olivia', 'Martin',   'olivia.martin@uwindsor.ca',  '519-555-0107', '2006-06-25', 2, 'COMP'),
(110200008, 'Noah',   'Singh',    'noah.singh@uwindsor.ca',     '519-555-0108', '2006-12-01', 2, 'MATH'),
(110200009, 'Grace',  'Liu',      'grace.liu@uwindsor.ca',      '519-555-0109', '2004-02-11', 4, 'COMP'),
(110200010, 'Samuel', 'Adeyemi',  'samuel.adeyemi@uwindsor.ca', '519-555-0110', '2004-08-19', 4, 'COMP'),
(110200011, 'Fatou',  'Diallo',   'fatou.diallo@uwindsor.ca',   '519-555-0111', '2004-05-05', 4, 'COMP'),
(110200012, 'Jack',   'Sullivan', 'jack.sullivan@uwindsor.ca',  '519-555-0112', '2004-10-27', 4, 'COMP');

INSERT INTO Instructor VALUES
(5001, 'Grace',  'Okafor', 'grace.okafor@uwindsor.ca',  'Lambton Tower 5105',   'COMP'),
(5002, 'Wei',    'Li',     'wei.li@uwindsor.ca',        'Lambton Tower 5120',   'COMP'),
(5003, 'Rahul',  'Mehta',  'rahul.mehta@uwindsor.ca',   'Lambton Tower 5140',   'COMP'),
(5004, 'James',  'Wilson', 'james.wilson@uwindsor.ca',  'Lambton Tower 5156',   'COMP'),
(5005, 'Fatima', 'Haddad', 'fatima.haddad@uwindsor.ca', 'Lambton Tower 10-104', 'MATH');

INSERT INTO Administrator VALUES
(9001, 'Linda', 'Carter', 'linda.carter@uwindsor.ca', 'Registrar'),
(9002, 'Kevin', 'Nguyen', 'kevin.nguyen@uwindsor.ca', 'Registrar Staff');

INSERT INTO Course VALUES
('COMP 1410', 'Introduction to Algorithms and Programming II', 'Pointers, recursion, basic data structures.', 3.0, 'COMP'),
('COMP 2120', 'Object-Oriented Programming Using Java',        'Classes, inheritance, interfaces.',          3.0, 'COMP'),
('COMP 2540', 'Data Structures and Algorithms',                'Trees, hashing, graphs, sorting.',           3.0, 'COMP'),
('COMP 3150', 'Database Management Systems',                   'Relational model, SQL, normalization.',      3.0, 'COMP'),
('COMP 3300', 'Operating Systems Fundamentals',                'Processes, scheduling, memory.',             3.0, 'COMP'),
('COMP 3340', 'World Wide Web Information Systems Development','Client and server-side web development.',    3.0, 'COMP'),
('COMP 3540', 'Theory of Computation',                         'Automata, grammars, computability.',         3.0, 'COMP'),
('COMP 4150', 'Advanced and Practical Database Systems',       'Transactions, procedures, triggers.',        3.0, 'COMP'),
('COMP 4300', 'Advanced Operating Systems',                    'Distributed systems and OS internals.',      3.0, 'COMP'),
('MATH 1020', 'Mathematical Foundations',                      'Logic, sets, functions, proofs.',            3.0, 'MATH');

INSERT INTO Prerequisite VALUES
('COMP 2120', 'COMP 1410', 'C-'),
('COMP 2540', 'COMP 1410', 'C-'),
('COMP 2540', 'MATH 1020', 'D-'),
('COMP 3150', 'COMP 2540', 'C'),
('COMP 3300', 'COMP 2540', 'C-'),
('COMP 3340', 'COMP 2120', 'C-'),
('COMP 3540', 'COMP 2540', 'C-'),
('COMP 4150', 'COMP 3150', 'C'),
('COMP 4300', 'COMP 3300', 'C-');

INSERT INTO Term VALUES
('F2025', 'Fall 2025',   '2025-09-03', '2025-12-17', '2025-09-16'),
('W2026', 'Winter 2026', '2026-01-07', '2026-04-24', '2026-01-20'),
('F2026', 'Fall 2026',   '2026-09-09', '2026-12-18', '2026-09-22'),
('W2027', 'Winter 2027', '2027-01-06', '2027-04-23', '2027-01-19');

INSERT INTO Room (Building, RoomNumber, Capacity) VALUES
('Dillon Hall',   '255',  60),   -- 1
('Erie Hall',     '3123', 45),   -- 2
('Essex Hall',    '186',  40),   -- 3
('Lambton Tower', '3105', 30),   -- 4
('Toldo HEC',     '100', 200);   -- 5

-- Sections (IDs given explicitly so the enrollment rows below are easy to read)
INSERT INTO Section (SectionID, CourseCode, TermID, SectionNumber, InstructorID, EnrollmentLimit, Status) VALUES
-- finished terms
( 1, 'COMP 1410', 'F2025', 1, 5002, 60, 'Closed'),
( 2, 'MATH 1020', 'F2025', 1, 5005, 60, 'Closed'),
( 3, 'COMP 2540', 'F2025', 1, 5002, 60, 'Closed'),
( 4, 'COMP 2120', 'F2025', 1, 5004, 60, 'Closed'),
( 5, 'COMP 2120', 'W2026', 1, 5004, 60, 'Closed'),
( 6, 'COMP 2540', 'W2026', 1, 5002, 60, 'Closed'),
( 7, 'COMP 3150', 'W2026', 1, 5001, 60, 'Closed'),
( 8, 'COMP 3300', 'W2026', 1, 5003, 60, 'Closed'),
-- current term
( 9, 'COMP 3300', 'F2026', 1, 5003, 60, 'Open'),
(10, 'COMP 4150', 'F2026', 1, 5001, 60, 'Open'),
(11, 'COMP 2540', 'F2026', 1, 5002, 60, 'Open'),
-- registration term
(12, 'COMP 3150', 'W2027', 1, 5001, 40, 'Open'),
(13, 'COMP 3150', 'W2027', 2, 5001, 14, 'Open'),
(14, 'COMP 3340', 'W2027', 1, 5004, 30, 'Open'),
(15, 'COMP 3540', 'W2027', 1, 5002, 40, 'Open'),
(16, 'COMP 4300', 'W2027', 1, 5003,  3, 'Open');
SELECT setval('section_sectionid_seq', 16);

INSERT INTO SectionMeeting (SectionID, DayOfWeek, StartTime, EndTime, RoomID) VALUES
( 9, 'Mon', '11:30', '12:50', 1), ( 9, 'Wed', '11:30', '12:50', 1),
(10, 'Tue', '14:30', '15:50', 1), (10, 'Thu', '14:30', '15:50', 1),
(11, 'Mon', '10:00', '11:20', 2), (11, 'Wed', '10:00', '11:20', 2),
(12, 'Tue', '11:30', '12:50', 3), (12, 'Thu', '11:30', '12:50', 3),
(13, 'Mon', '14:30', '15:50', 4), (13, 'Wed', '14:30', '15:50', 4),
(14, 'Tue', '11:30', '12:50', 2), (14, 'Thu', '11:30', '12:50', 2),
(15, 'Tue', '08:30', '09:50', 2), (15, 'Thu', '08:30', '09:50', 2),
(16, 'Mon', '11:30', '12:50', 4), (16, 'Wed', '11:30', '12:50', 4);

-- Completed courses (the transcript used to check prerequisites)
INSERT INTO Enrollment (StudentID, SectionID, EnrollDate, Status, Grade) VALUES
-- year 3: COMP 1410 + MATH 1020 in Fall 2025, COMP 2120 + COMP 2540 in Winter 2026
(110200001, 1, '2025-08-10', 'Completed', 'A'),  (110200001, 2, '2025-08-10', 'Completed', 'B+'),
(110200001, 5, '2025-12-01', 'Completed', 'B+'), (110200001, 6, '2025-12-01', 'Completed', 'B'),
(110200002, 1, '2025-08-11', 'Completed', 'B'),  (110200002, 2, '2025-08-11', 'Completed', 'B'),
(110200002, 5, '2025-12-02', 'Completed', 'A-'), (110200002, 6, '2025-12-02', 'Completed', 'C+'),
(110200003, 1, '2025-08-12', 'Completed', 'B-'), (110200003, 2, '2025-08-12', 'Completed', 'C'),
(110200003, 5, '2025-12-03', 'Completed', 'B'),  (110200003, 6, '2025-12-03', 'Completed', 'D'),   -- below the C needed for COMP 3150
(110200004, 1, '2025-08-12', 'Completed', 'A+'), (110200004, 2, '2025-08-12', 'Completed', 'A'),
(110200004, 5, '2025-12-03', 'Completed', 'A'),  (110200004, 6, '2025-12-03', 'Completed', 'A-'),
(110200005, 1, '2025-08-13', 'Completed', 'B+'), (110200005, 2, '2025-08-13', 'Completed', 'A-'),
(110200005, 5, '2025-12-04', 'Completed', 'B'),  (110200005, 6, '2025-12-04', 'Completed', 'B+'),
-- year 2: COMP 1410 + MATH 1020 in Fall 2025, COMP 2120 in Winter 2026
(110200006, 1, '2025-08-14', 'Completed', 'B'),  (110200006, 2, '2025-08-14', 'Completed', 'A'),  (110200006, 5, '2025-12-05', 'Completed', 'B+'),
(110200007, 1, '2025-08-14', 'Completed', 'A-'), (110200007, 2, '2025-08-14', 'Completed', 'B'),  (110200007, 5, '2025-12-05', 'Completed', 'A'),
(110200008, 1, '2025-08-15', 'Completed', 'C+'), (110200008, 2, '2025-08-15', 'Completed', 'B-'), (110200008, 5, '2025-12-06', 'Completed', 'B'),
-- year 4: COMP 2120 + COMP 2540 in Fall 2025, COMP 3150 + COMP 3300 in Winter 2026
(110200009, 4, '2025-08-09', 'Completed', 'A'),  (110200009, 3, '2025-08-09', 'Completed', 'A-'),
(110200009, 7, '2025-11-30', 'Completed', 'B+'), (110200009, 8, '2025-11-30', 'Completed', 'A'),
(110200010, 4, '2025-08-09', 'Completed', 'B+'), (110200010, 3, '2025-08-09', 'Completed', 'B'),
(110200010, 7, '2025-11-30', 'Completed', 'B'),  (110200010, 8, '2025-11-30', 'Completed', 'B+'),
(110200011, 4, '2025-08-10', 'Completed', 'A-'), (110200011, 3, '2025-08-10', 'Completed', 'B+'),
(110200011, 7, '2025-12-01', 'Completed', 'A'),  (110200011, 8, '2025-12-01', 'Completed', 'B'),
(110200012, 4, '2025-08-10', 'Completed', 'B'),  (110200012, 3, '2025-08-10', 'Completed', 'C+'),
(110200012, 7, '2025-12-01', 'Completed', 'B-'), (110200012, 8, '2025-12-01', 'Completed', 'C');

-- Fall 2026 (in progress)
INSERT INTO Enrollment (StudentID, SectionID, EnrollDate) VALUES
(110200001, 9, '2026-08-01'), (110200002, 9, '2026-08-01'), (110200003, 9, '2026-08-02'),
(110200004, 9, '2026-08-02'), (110200005, 9, '2026-08-03'),
(110200006, 11, '2026-08-04'), (110200007, 11, '2026-08-04'), (110200008, 11, '2026-08-05'),
(110200009, 10, '2026-08-01'), (110200010, 10, '2026-08-01'),
(110200011, 10, '2026-08-02'), (110200012, 10, '2026-08-02');

-- Winter 2027 registrations made so far
INSERT INTO Enrollment (StudentID, SectionID, EnrollDate) VALUES
(110200001, 15, '2026-11-02'),                                 -- Aisha: COMP 3540
(110200002, 15, '2026-11-02'), (110200002, 14, '2026-11-02'),  -- Marcus: COMP 3540, COMP 3340 (Tue/Thu 11:30)
(110200003, 14, '2026-11-03'),                                 -- Priya: COMP 3340
(110200004, 13, '2026-11-03'), (110200005, 13, '2026-11-03'),  -- COMP 3150-02: 2 of 14 taken -> 12 seats left
(110200009, 16, '2026-11-04'), (110200010, 16, '2026-11-04');  -- COMP 4300: 2 of 3 taken -> 1 seat left
