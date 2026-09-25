-- Student-driven signature placement: the signing area differs between
-- versions of the course registration form, so the position can no longer be
-- a single admin-configured value. The admin now only uploads the signature
-- image per signer kind; the student drags/aligns it onto their own form
-- before approving. Drop the placement columns that were stamped server-side
-- from one global value.
ALTER TABLE crf_signature_assets
    DROP COLUMN IF EXISTS page_number,
    DROP COLUMN IF EXISTS x_pt,
    DROP COLUMN IF EXISTS y_pt,
    DROP COLUMN IF EXISTS width_pt,
    DROP COLUMN IF EXISTS max_height_pt,
    DROP COLUMN IF EXISTS show_date,
    DROP COLUMN IF EXISTS date_x_pt,
    DROP COLUMN IF EXISTS date_y_pt,
    DROP COLUMN IF EXISTS date_font_size;

-- What the student approved, one JSON object per signer kind, e.g.
--   {"hod": {"page":1,"x":120,"y":640,"width":110,"max_height":34,
--            "show_date":true,"date_x":120,"date_y":600,"date_font_size":10}}
-- Stored at approve time so the stamped PDF can be reproduced/audited.
ALTER TABLE crf_signing_submissions
    ADD COLUMN IF NOT EXISTS placements JSONB NOT NULL DEFAULT '{}'::jsonb;
