-- Alumni Donations
CREATE TYPE donation_channel AS ENUM ('general', 'scholarship', 'project', 'event_sponsorship', 'emergency');
CREATE TYPE donation_tier AS ENUM ('none', 'bronze', 'silver', 'gold', 'platinum');

CREATE TABLE alumni_donations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    donor_id UUID NOT NULL REFERENCES users(id),
    channel donation_channel NOT NULL DEFAULT 'general',
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 1000),
    currency VARCHAR(3) NOT NULL DEFAULT 'NGN',
    payment_id UUID,
    receipt_url TEXT,
    message TEXT,
    is_anonymous BOOLEAN NOT NULL DEFAULT false,
    recognized_tier donation_tier NOT NULL DEFAULT 'none',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_alumni_donations_donor ON alumni_donations(donor_id);
CREATE INDEX idx_alumni_donations_channel ON alumni_donations(channel);
CREATE INDEX idx_alumni_donations_status ON alumni_donations(status);

-- Alumni status extensions
ALTER TABLE alumni_status ADD COLUMN IF NOT EXISTS location VARCHAR(255);
ALTER TABLE alumni_status ADD COLUMN IF NOT EXISTS portfolio_url TEXT;
ALTER TABLE alumni_status ADD COLUMN IF NOT EXISTS skills JSONB DEFAULT '[]';
ALTER TABLE alumni_status ADD COLUMN IF NOT EXISTS mentorship_topics JSONB DEFAULT '[]';
ALTER TABLE alumni_status ADD COLUMN IF NOT EXISTS willing_to_speak BOOLEAN DEFAULT false;
ALTER TABLE alumni_status ADD COLUMN IF NOT EXISTS event_interests JSONB DEFAULT '[]';
ALTER TABLE alumni_status ADD COLUMN IF NOT EXISTS privacy_level VARCHAR(20) DEFAULT 'public';
ALTER TABLE alumni_status ADD COLUMN IF NOT EXISTS donation_total NUMERIC(12,2) DEFAULT 0;
ALTER TABLE alumni_status ADD COLUMN IF NOT EXISTS mentorship_sessions_count INT DEFAULT 0;
ALTER TABLE alumni_status ADD COLUMN IF NOT EXISTS jobs_posted_count INT DEFAULT 0;
ALTER TABLE alumni_status ADD COLUMN IF NOT EXISTS events_attended_count INT DEFAULT 0;
ALTER TABLE alumni_status ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
