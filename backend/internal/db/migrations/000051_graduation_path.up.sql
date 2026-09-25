-- Graduation path for final-year (500 level) students: they are exempt from
-- the regular dues cycle and instead pay a one-off CRF signing fee. The fee
-- is admin-editable, singleton row (same pattern as crf_backlog_price).
CREATE TABLE graduation_fee (
    id INT PRIMARY KEY DEFAULT 1,
    amount NUMERIC(10,2) NOT NULL DEFAULT 1500,
    updated_by UUID REFERENCES users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT graduation_fee_singleton CHECK (id = 1)
);

INSERT INTO graduation_fee (id, amount) VALUES (1, 1500);

-- One graduation request per student (user_id UNIQUE). The fee is
-- snapshotted into amount_charged at request time so a later admin price
-- change doesn't retroactively change what an existing request owes.
-- Lifecycle: pending_payment -> paid (payment pipeline) -> cleared (staff).
-- waived = staff cleared the student without any fee being collected
-- (amount_charged is then 0).
CREATE TABLE graduation_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    amount_charged NUMERIC(10,2) NOT NULL,
    payment_id UUID UNIQUE REFERENCES payments(id),
    status VARCHAR(20) NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'paid', 'cleared')),
    waived BOOLEAN NOT NULL DEFAULT false,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paid_at TIMESTAMPTZ,
    cleared_by UUID REFERENCES users(id),
    cleared_at TIMESTAMPTZ
);

CREATE INDEX idx_graduation_requests_user ON graduation_requests(user_id);
