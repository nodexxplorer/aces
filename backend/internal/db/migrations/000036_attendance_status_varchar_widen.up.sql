-- 'pending_lecturer_review' is 24 characters — status VARCHAR(20) rejected
-- it with "value too long for type character varying(20)" on every submit,
-- the same silent-failure bug class as the CHECK constraint fixed in
-- migration 000035, just one layer deeper.
ALTER TABLE attendance_sessions ALTER COLUMN status TYPE VARCHAR(30);
