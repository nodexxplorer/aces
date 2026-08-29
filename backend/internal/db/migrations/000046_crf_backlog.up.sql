-- Configurable per-backlog fee, admin-editable. Singleton row (id fixed to 1).
CREATE TABLE crf_backlog_price (
    id INT PRIMARY KEY DEFAULT 1,
    amount_per_backlog NUMERIC(10,2) NOT NULL DEFAULT 1000,
    updated_by UUID REFERENCES users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT crf_backlog_price_singleton CHECK (id = 1)
);

INSERT INTO crf_backlog_price (id, amount_per_backlog) VALUES (1, 1000);

-- A student's declared batch of old/unsigned course forms they want to
-- catch up on. total amount = requested_count * price-per-backlog at the
-- time of the request (snapshotted, so a later admin price change doesn't
-- retroactively change what's owed on an already-created request).
CREATE TABLE crf_backlog_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    requested_count INT NOT NULL CHECK (requested_count > 0),
    amount NUMERIC(10,2) NOT NULL,
    payment_id UUID REFERENCES payments(id),
    status VARCHAR(20) NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'paid')),
    forms_submitted INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paid_at TIMESTAMPTZ
);

CREATE INDEX idx_crf_backlog_requests_user ON crf_backlog_requests(user_id);
