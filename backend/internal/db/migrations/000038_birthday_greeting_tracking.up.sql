-- Tracks the year a student was last sent their birthday greeting, so the
-- scheduler (which polls hourly, see internal/api/birthday.go) doesn't
-- re-send if it wakes up more than once on the same calendar day.
ALTER TABLE users ADD COLUMN last_birthday_greeted_year SMALLINT;
