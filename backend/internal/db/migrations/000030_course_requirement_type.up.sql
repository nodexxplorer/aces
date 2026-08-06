-- Core vs Elective classification for courses — independent of the
-- existing departmental/non-departmental course_type (which governs
-- cross-department registration eligibility, not whether a course is
-- mandatory for the student's programme).
ALTER TABLE courses ADD COLUMN requirement_type VARCHAR(20) NOT NULL DEFAULT 'core';
