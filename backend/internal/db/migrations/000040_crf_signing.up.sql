-- Signature image + placement for each authorized signer, stamped onto
-- student-uploaded course registration forms. One row per kind — recalibrating
-- or re-uploading a signature upserts in place, since placement is the same
-- for every student (same official CRF template).
CREATE TABLE IF NOT EXISTS crf_signature_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind VARCHAR(20) NOT NULL UNIQUE CHECK (kind IN ('hod', 'exam_officer')),
    file_path TEXT NOT NULL,
    page_number INT NOT NULL DEFAULT 1,
    x_pt NUMERIC NOT NULL,
    y_pt NUMERIC NOT NULL,
    width_pt NUMERIC NOT NULL,
    uploaded_by UUID REFERENCES users(id),
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A student's own signed CRF for a given semester — capped at one per
-- student per semester via the unique constraint below.
CREATE TABLE IF NOT EXISTS crf_signing_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    semester_id UUID NOT NULL REFERENCES semesters(id),
    original_file_path TEXT NOT NULL,
    signed_file_path TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'completed',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, semester_id)
);

CREATE INDEX IF NOT EXISTS idx_crf_signing_submissions_user ON crf_signing_submissions(user_id);
