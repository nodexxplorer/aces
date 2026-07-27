-- Add missing values to the existing report_status enum that migration 16 intended to have
-- Migration 11 created report_status with ('generating', 'completed', 'failed')
-- Migration 16 tried to add ('pending', 'reviewed', 'resolved', 'dismissed') but silently failed

DO $$ BEGIN
    ALTER TYPE report_status ADD VALUE 'pending';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TYPE report_status ADD VALUE 'reviewed';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TYPE report_status ADD VALUE 'resolved';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TYPE report_status ADD VALUE 'dismissed';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
