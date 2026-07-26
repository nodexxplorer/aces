-- Make student_id nullable and add matric_number for deferred student linkage
ALTER TABLE results ALTER COLUMN student_id DROP NOT NULL;
ALTER TABLE results ADD COLUMN matric_number TEXT;

-- Create index for fast matric_number lookups during auto-linking
CREATE INDEX idx_results_matric_number ON results(matric_number) WHERE matric_number IS NOT NULL;

-- Create function to auto-link results to students by matric_number
CREATE OR REPLACE FUNCTION link_pending_results()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE results
    SET student_id = NEW.id
    WHERE matric_number = NEW.matric_number
      AND student_id IS NULL;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: when a student row is inserted, link any pending results
CREATE TRIGGER trg_link_pending_results
    AFTER INSERT ON students
    FOR EACH ROW
    EXECUTE FUNCTION link_pending_results();
