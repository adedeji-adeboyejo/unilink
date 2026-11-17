-- =====================================================================
-- UniLink  |  File 6: Login accounts (Use case 01, FR1, security requirement S1)
--
-- The GUI needs a login for each role (Student, Instructor, Admin).
-- Passwords are stored only as salted bcrypt hashes, using PostgreSQL's
-- pgcrypto extension - the plain password is never saved.
--
-- Username = the part of the email before the @ (e.g. aisha.khan)
-- Demo password for every account: password123
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP TABLE IF EXISTS UserAccount;
CREATE TABLE UserAccount (
    Username     VARCHAR(50) PRIMARY KEY,
    PasswordHash TEXT        NOT NULL,
    Role         VARCHAR(10) NOT NULL CHECK (Role IN ('Student', 'Instructor', 'Admin')),
    LinkedID     INT         NOT NULL,   -- StudentID, InstructorID or AdminID
    UNIQUE (Role, LinkedID)              -- one account per person
);

INSERT INTO UserAccount (Username, PasswordHash, Role, LinkedID)
SELECT split_part(Email, '@', 1), crypt('password123', gen_salt('bf')), 'Student', StudentID
FROM Student
UNION ALL
SELECT split_part(Email, '@', 1), crypt('password123', gen_salt('bf')), 'Instructor', InstructorID
FROM Instructor
UNION ALL
SELECT split_part(Email, '@', 1), crypt('password123', gen_salt('bf')), 'Admin', AdminID
FROM Administrator;
