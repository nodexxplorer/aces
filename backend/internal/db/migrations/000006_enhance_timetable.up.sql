-- Migration 000006: Enhance timetable for class + exam types with conflict detection and publish workflow

-- Entry type: 'class' for weekly lecture schedule, 'exam' for exam schedule
ALTER TABLE timetable ADD COLUMN IF NOT EXISTS entry_type VARCHAR(10) NOT NULL DEFAULT 'class';

-- Class-specific fields
ALTER TABLE timetable ADD COLUMN IF NOT EXISTS class_type VARCHAR(20); -- lecture, lab, tutorial, seminar
ALTER TABLE timetable ADD COLUMN IF NOT EXISTS lecturer_id UUID REFERENCES users(id);

-- Exam-specific fields
ALTER TABLE timetable ADD COLUMN IF NOT EXISTS exam_type VARCHAR(20); -- main, carryover
ALTER TABLE timetable ADD COLUMN IF NOT EXISTS invigilators TEXT;

-- Publish workflow
ALTER TABLE timetable ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE timetable ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- Index for filtering by type
CREATE INDEX IF NOT EXISTS idx_timetable_entry_type ON timetable(entry_type);
