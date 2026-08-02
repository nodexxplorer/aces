-- Add missing values to the existing report_status enum that migration 16 intended to have
-- Migration 11 created report_status with ('generating', 'completed', 'failed')
-- Migration 16 tried to add ('pending', 'reviewed', 'resolved', 'dismissed') but silently failed

ALTER TYPE report_status ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE report_status ADD VALUE IF NOT EXISTS 'reviewed';
ALTER TYPE report_status ADD VALUE IF NOT EXISTS 'resolved';
ALTER TYPE report_status ADD VALUE IF NOT EXISTS 'dismissed';

