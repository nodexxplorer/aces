-- Reverse of 000015_additional_features.up.sql, dropped in dependency order
-- (triggers, then tables — children before parents — then types).

DROP TRIGGER IF EXISTS update_help_articles_updated_at ON help_articles;
DROP TRIGGER IF EXISTS update_gpa_scenarios_updated_at ON gpa_scenarios;
DROP TRIGGER IF EXISTS update_feature_flags_updated_at ON feature_flags;
DROP TRIGGER IF EXISTS update_expense_budgets_updated_at ON expense_budgets;
DROP TRIGGER IF EXISTS update_grade_appeals_updated_at ON grade_appeals;
DROP TRIGGER IF EXISTS update_class_notices_updated_at ON class_notices;
DROP TRIGGER IF EXISTS update_study_tasks_updated_at ON study_tasks;
DROP TRIGGER IF EXISTS update_account_lockouts_updated_at ON account_lockouts;

DROP TABLE IF EXISTS gpa_scenarios;
DROP TABLE IF EXISTS help_articles;
DROP TABLE IF EXISTS feedback_submissions;
DROP TABLE IF EXISTS feature_flags;
DROP TABLE IF EXISTS expense_budgets;
DROP TABLE IF EXISTS expenses;
DROP TABLE IF EXISTS departmental_events;
DROP TABLE IF EXISTS broadcast_acknowledgments;
DROP TABLE IF EXISTS emergency_broadcasts;
DROP TABLE IF EXISTS meeting_attendees;
DROP TABLE IF EXISTS staff_meetings;
DROP TABLE IF EXISTS class_notice_comments;
DROP TABLE IF EXISTS class_notices;
DROP TABLE IF EXISTS study_tasks;
DROP TABLE IF EXISTS grade_appeals;
DROP TABLE IF EXISTS active_sessions;
DROP TABLE IF EXISTS account_lockouts;
DROP TABLE IF EXISTS password_resets;

DROP TYPE IF EXISTS feedback_status;
DROP TYPE IF EXISTS feedback_type;
DROP TYPE IF EXISTS expense_status;
DROP TYPE IF EXISTS calendar_event_type;
DROP TYPE IF EXISTS broadcast_priority;
DROP TYPE IF EXISTS meeting_status;
DROP TYPE IF EXISTS task_status;
DROP TYPE IF EXISTS task_priority;
DROP TYPE IF EXISTS appeal_status;
DROP TYPE IF EXISTS reset_channel;
