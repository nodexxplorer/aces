DROP INDEX IF EXISTS idx_timetable_entry_type;
ALTER TABLE timetable DROP COLUMN IF EXISTS is_published;
ALTER TABLE timetable DROP COLUMN IF EXISTS published_at;
ALTER TABLE timetable DROP COLUMN IF EXISTS invigilators;
ALTER TABLE timetable DROP COLUMN IF EXISTS exam_type;
ALTER TABLE timetable DROP COLUMN IF EXISTS lecturer_id;
ALTER TABLE timetable DROP COLUMN IF EXISTS class_type;
ALTER TABLE timetable DROP COLUMN IF EXISTS entry_type;
