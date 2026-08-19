-- A live date stamp next to each signature (today's date at signing time,
-- not a fixed value), with its own adjustable placement and font size
-- independent of the signature image's position.
ALTER TABLE crf_signature_assets ADD COLUMN IF NOT EXISTS show_date BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE crf_signature_assets ADD COLUMN IF NOT EXISTS date_x_pt NUMERIC;
ALTER TABLE crf_signature_assets ADD COLUMN IF NOT EXISTS date_y_pt NUMERIC;
ALTER TABLE crf_signature_assets ADD COLUMN IF NOT EXISTS date_font_size NUMERIC NOT NULL DEFAULT 10;
