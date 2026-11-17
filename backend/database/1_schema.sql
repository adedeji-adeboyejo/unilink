-- =====================================================================
-- UniLink: University Course Registration System
-- COMP 4150 - Step 4 Implementation  |  File 1: Schema (PostgreSQL)
-- Sriram Pragalathan (110156476), Adedeji Adeboyejo (110125235)
--
-- Implements the relational schema from Part 3: 11 relations with the
-- same primary keys, foreign keys, ON DELETE rules and constraints.
-- =====================================================================

DROP TABLE IF EXISTS Enrollment, SectionMeeting, Section, Room, Term,
                     Prerequisite, Course, Administrator, Instructor,
                     Student, Department CASCADE;

CREATE TABLE Department (
    DeptID    VARCHAR(10)  PRIMARY KEY,
    DeptName  VARCHAR(100) NOT NULL,
    Building  VARCHAR(60),
    Phone     VARCHAR(20)
);

CREATE TABLE Student (
    StudentID   INT          PRIMARY KEY,
    FirstName   VARCHAR(50)  NOT NULL,
    LastName    VARCHAR(50)  NOT NULL,
    Email       VARCHAR(120) NOT NULL UNIQUE,
    Phone       VARCHAR(20),
    DateOfBirth DATE,
    YearLevel   INT          CHECK (YearLevel BETWEEN 1 AND 6),
    MajorDeptID VARCHAR(10)  REFERENCES Department(DeptID) ON DELETE RESTRICT
);

CREATE TABLE Instructor (
    InstructorID   INT          PRIMARY KEY,
    FirstName      VARCHAR(50)  NOT NULL,
    LastName       VARCHAR(50)  NOT NULL,
    Email          VARCHAR(120) NOT NULL UNIQUE,
    OfficeLocation VARCHAR(60),
    DeptID         VARCHAR(10)  REFERENCES Department(DeptID) ON DELETE RESTRICT
);

CREATE TABLE Administrator (
    AdminID   INT          PRIMARY KEY,
    FirstName VARCHAR(50)  NOT NULL,
    LastName  VARCHAR(50)  NOT NULL,
    Email     VARCHAR(120) NOT NULL UNIQUE,
    Role      VARCHAR(40)
);

CREATE TABLE Course (
    CourseCode  VARCHAR(10)  PRIMARY KEY,
    Title       VARCHAR(120) NOT NULL,
    Description TEXT,
    Credits     NUMERIC(3,1) NOT NULL CHECK (Credits > 0),
    DeptID      VARCHAR(10)  REFERENCES Department(DeptID) ON DELETE RESTRICT
);

CREATE TABLE Prerequisite (
    CourseCode       VARCHAR(10) REFERENCES Course(CourseCode) ON DELETE CASCADE,
    PrereqCourseCode VARCHAR(10) REFERENCES Course(CourseCode) ON DELETE CASCADE,
    MinGrade         VARCHAR(2)  NOT NULL DEFAULT 'D-',
    PRIMARY KEY (CourseCode, PrereqCourseCode),
    CHECK (CourseCode <> PrereqCourseCode)            -- not its own prerequisite
);

CREATE TABLE Term (
    TermID          VARCHAR(10) PRIMARY KEY,
    TermName        VARCHAR(40) NOT NULL,
    StartDate       DATE        NOT NULL,
    EndDate         DATE        NOT NULL,
    AddDropDeadline DATE        NOT NULL,
    CHECK (EndDate > StartDate)
);

CREATE TABLE Section (
    SectionID       SERIAL      PRIMARY KEY,
    CourseCode      VARCHAR(10) NOT NULL REFERENCES Course(CourseCode) ON DELETE RESTRICT,
    TermID          VARCHAR(10) NOT NULL REFERENCES Term(TermID) ON DELETE RESTRICT,
    SectionNumber   INT         NOT NULL,
    InstructorID    INT         REFERENCES Instructor(InstructorID) ON DELETE SET NULL,
    EnrollmentLimit INT         NOT NULL CHECK (EnrollmentLimit > 0),
    Status          VARCHAR(10) NOT NULL DEFAULT 'Open'
                    CHECK (Status IN ('Open', 'Full', 'Closed')),
    UNIQUE (CourseCode, TermID, SectionNumber)        -- natural key
);

CREATE TABLE Room (
    RoomID     SERIAL      PRIMARY KEY,
    Building   VARCHAR(60) NOT NULL,
    RoomNumber VARCHAR(10) NOT NULL,
    Capacity   INT         NOT NULL CHECK (Capacity > 0),
    UNIQUE (Building, RoomNumber)
);

CREATE TABLE SectionMeeting (
    MeetingID SERIAL     PRIMARY KEY,
    SectionID INT        NOT NULL REFERENCES Section(SectionID) ON DELETE CASCADE,
    DayOfWeek VARCHAR(3) NOT NULL CHECK (DayOfWeek IN ('Mon','Tue','Wed','Thu','Fri')),
    StartTime TIME       NOT NULL,
    EndTime   TIME       NOT NULL,
    RoomID    INT        NOT NULL REFERENCES Room(RoomID) ON DELETE RESTRICT,
    CHECK (EndTime > StartTime),
    UNIQUE (SectionID, DayOfWeek, StartTime)
);

CREATE TABLE Enrollment (
    EnrollmentID       SERIAL      PRIMARY KEY,
    StudentID          INT         NOT NULL REFERENCES Student(StudentID) ON DELETE RESTRICT,
    SectionID          INT         NOT NULL REFERENCES Section(SectionID) ON DELETE RESTRICT,
    EnrollDate         TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Status             VARCHAR(10) NOT NULL DEFAULT 'Enrolled'
                       CHECK (Status IN ('Enrolled', 'Waitlisted', 'Dropped', 'Completed')),
    Grade              VARCHAR(2),
    DropDate           TIMESTAMP,
    ProcessedByAdminID INT         REFERENCES Administrator(AdminID) ON DELETE SET NULL,
    UNIQUE (StudentID, SectionID)                     -- cannot register twice for a section
);

-- Indexes on columns used for searching and joining (NFR P4)
CREATE INDEX idx_section_term       ON Section (TermID);
CREATE INDEX idx_section_instructor ON Section (InstructorID);
CREATE INDEX idx_enrollment_section ON Enrollment (SectionID, Status);
CREATE INDEX idx_meeting_room       ON SectionMeeting (RoomID, DayOfWeek);
