-- notifications.type was a narrow 9-value enum, but every feature added
-- since (payments, academic events, attendance, etc.) invented its own type
-- string assuming free text — exactly like category and priority on this
-- same table already are. Every one of those mismatched inserts was
-- silently failing (logged, never surfaced), so only login/general-category
-- notifications ever actually got created. Match the column to how it's
-- actually used instead of an enum that was never going to keep up.
ALTER TABLE notifications ALTER COLUMN type TYPE VARCHAR(50) USING type::text;
