-- 000003_blueprint_v5_tables.up.sql
-- Adds all missing tables from ACES Zone Blueprint v5.1
-- Multi-role, manuals, campus connect, skills/trade, alumni

-- ==================== ENUMS ====================

CREATE TYPE connection_status AS ENUM ('pending', 'accepted', 'rejected', 'blocked');
CREATE TYPE trade_status AS ENUM ('pending', 'accepted', 'completed', 'cancelled');
CREATE TYPE skill_level AS ENUM ('beginner', 'intermediate', 'advanced', 'expert');
CREATE TYPE mentorship_status AS ENUM ('pending', 'accepted', 'active', 'completed', 'declined');
CREATE TYPE job_type AS ENUM ('full_time', 'part_time', 'internship', 'contract', 'remote');
CREATE TYPE application_status AS ENUM ('pending', 'reviewed', 'shortlisted', 'accepted', 'rejected');
CREATE TYPE alumni_verification_status AS ENUM ('pending', 'verified', 'rejected');

-- ==================== MULTI-ROLE TABLES ====================

CREATE TABLE user_role_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role user_role NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    assigned_by UUID REFERENCES users(id),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    UNIQUE(user_id, role)
);

CREATE INDEX idx_user_role_assignments_user ON user_role_assignments(user_id);
CREATE INDEX idx_user_role_assignments_role ON user_role_assignments(role);

CREATE TABLE role_promotions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    from_role user_role,
    to_role user_role NOT NULL,
    promoted_by UUID NOT NULL REFERENCES users(id),
    reason TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_role_promotions_user ON role_promotions(user_id);
CREATE INDEX idx_role_promotions_promoted_by ON role_promotions(promoted_by);

CREATE TABLE bursar_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    level INTEGER NOT NULL,
    bursar_type VARCHAR(20) NOT NULL, -- 'class' or 'dept'
    session_id UUID REFERENCES sessions(id),
    assigned_by UUID NOT NULL REFERENCES users(id),
    is_active BOOLEAN NOT NULL DEFAULT true,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    UNIQUE(user_id, level, bursar_type)
);

CREATE INDEX idx_bursar_assignments_user ON bursar_assignments(user_id);
CREATE INDEX idx_bursar_assignments_level ON bursar_assignments(level);

-- ==================== COURSE SUBCATEGORIES ====================

CREATE TABLE course_subcategories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL, -- 'theory', 'practical', 'theory_practical'
    weight_percentage INTEGER NOT NULL DEFAULT 100,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(course_id, name)
);

CREATE INDEX idx_course_subcategories_course ON course_subcategories(course_id);

-- ==================== MANUALS & PRACTICAL ENROLLMENT ====================

CREATE TABLE manuals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    level INTEGER NOT NULL,
    price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    file_url TEXT,
    cover_image_url TEXT,
    course_id UUID REFERENCES courses(id),
    session_id UUID REFERENCES sessions(id),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_manuals_level ON manuals(level);
CREATE INDEX idx_manuals_course ON manuals(course_id);

CREATE TABLE manual_purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    manual_id UUID NOT NULL REFERENCES manuals(id),
    payment_id UUID REFERENCES payments(id),
    qr_code_data TEXT,
    qr_code_url TEXT,
    is_collected BOOLEAN NOT NULL DEFAULT false,
    collected_at TIMESTAMPTZ,
    purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(student_id, manual_id)
);

CREATE INDEX idx_manual_purchases_student ON manual_purchases(student_id);
CREATE INDEX idx_manual_purchases_manual ON manual_purchases(manual_id);

CREATE TABLE manual_print_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_id UUID NOT NULL REFERENCES manual_purchases(id),
    student_id UUID NOT NULL REFERENCES students(id),
    manual_id UUID NOT NULL REFERENCES manuals(id),
    status VARCHAR(20) NOT NULL DEFAULT 'queued', -- 'queued', 'printing', 'ready', 'collected'
    queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    printed_at TIMESTAMPTZ,
    collected_at TIMESTAMPTZ,
    processed_by UUID REFERENCES users(id)
);

CREATE INDEX idx_print_queue_status ON manual_print_queue(status);
CREATE INDEX idx_print_queue_student ON manual_print_queue(student_id);

CREATE TABLE practical_enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id),
    manual_purchase_id UUID REFERENCES manual_purchases(id),
    session_id UUID NOT NULL REFERENCES sessions(id),
    enrolled_via VARCHAR(20) NOT NULL DEFAULT 'qr_scan', -- 'qr_scan', 'manual', 'admin'
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(student_id, course_id, session_id)
);

CREATE INDEX idx_practical_enrollments_student ON practical_enrollments(student_id);
CREATE INDEX idx_practical_enrollments_course ON practical_enrollments(course_id);

-- ==================== CAMPUS CONNECT ====================

CREATE TABLE connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status connection_status NOT NULL DEFAULT 'pending',
    message TEXT,
    responded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(requester_id, receiver_id),
    CHECK (requester_id != receiver_id)
);

CREATE INDEX idx_connections_requester ON connections(requester_id);
CREATE INDEX idx_connections_receiver ON connections(receiver_id);
CREATE INDEX idx_connections_status ON connections(status);

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_receiver ON messages(receiver_id);
CREATE INDEX idx_messages_created ON messages(created_at);

CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL DEFAULT 'study', -- 'study', 'project', 'interest', 'class'
    avatar_url TEXT,
    max_members INTEGER DEFAULT 100,
    is_private BOOLEAN NOT NULL DEFAULT false,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_groups_category ON groups(category);
CREATE INDEX idx_groups_created_by ON groups(created_by);

CREATE TABLE group_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'member', -- 'admin', 'moderator', 'member'
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(group_id, user_id)
);

CREATE INDEX idx_group_members_group ON group_members(group_id);
CREATE INDEX idx_group_members_user ON group_members(user_id);

CREATE TABLE group_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_group_messages_group ON group_messages(group_id);
CREATE INDEX idx_group_messages_created ON group_messages(created_at);

-- ==================== SKILLS & TRADE ====================

CREATE TABLE skill_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    icon VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE skill_listings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES skill_categories(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    skill_level skill_level NOT NULL DEFAULT 'intermediate',
    price DECIMAL(10,2),
    is_free BOOLEAN NOT NULL DEFAULT false,
    barter_available BOOLEAN NOT NULL DEFAULT false,
    barter_description TEXT,
    portfolio_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_skill_listings_user ON skill_listings(user_id);
CREATE INDEX idx_skill_listings_category ON skill_listings(category_id);
CREATE INDEX idx_skill_listings_level ON skill_listings(skill_level);

CREATE TABLE trade_offers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    offered_skill_id UUID NOT NULL REFERENCES skill_listings(id),
    requested_skill_id UUID REFERENCES skill_listings(id),
    status trade_status NOT NULL DEFAULT 'pending',
    message TEXT,
    price_offered DECIMAL(10,2),
    is_barter BOOLEAN NOT NULL DEFAULT false,
    responded_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (from_user_id != to_user_id)
);

CREATE INDEX idx_trade_offers_from ON trade_offers(from_user_id);
CREATE INDEX idx_trade_offers_to ON trade_offers(to_user_id);
CREATE INDEX idx_trade_offers_status ON trade_offers(status);

CREATE TABLE skill_ratings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trade_id UUID NOT NULL REFERENCES trade_offers(id),
    rater_id UUID NOT NULL REFERENCES users(id),
    rated_user_id UUID NOT NULL REFERENCES users(id),
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(trade_id, rater_id)
);

CREATE INDEX idx_skill_ratings_rated_user ON skill_ratings(rated_user_id);
CREATE INDEX idx_skill_ratings_trade ON skill_ratings(trade_id);

CREATE TABLE user_reputation (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    total_ratings INTEGER NOT NULL DEFAULT 0,
    average_rating DECIMAL(3,2) NOT NULL DEFAULT 0.00,
    total_trades_completed INTEGER NOT NULL DEFAULT 0,
    reputation_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_reputation_score ON user_reputation(reputation_score DESC);

-- ==================== ALUMNI SYSTEM ====================

CREATE TABLE alumni_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    graduation_year INTEGER NOT NULL,
    graduation_class VARCHAR(50),
    verification_status alumni_verification_status NOT NULL DEFAULT 'pending',
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMPTZ,
    is_mentor_available BOOLEAN NOT NULL DEFAULT false,
    mentor_specialization TEXT,
    current_company VARCHAR(255),
    current_position VARCHAR(255),
    linkedin_url TEXT,
    bio TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alumni_status_user ON alumni_status(user_id);
CREATE INDEX idx_alumni_status_year ON alumni_status(graduation_year);
CREATE INDEX idx_alumni_status_verification ON alumni_status(verification_status);
CREATE INDEX idx_alumni_status_mentor ON alumni_status(is_mentor_available) WHERE is_mentor_available = true;

CREATE TABLE mentorship_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mentor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status mentorship_status NOT NULL DEFAULT 'pending',
    topic VARCHAR(255) NOT NULL,
    message TEXT,
    responded_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (student_id != mentor_id)
);

CREATE INDEX idx_mentorship_student ON mentorship_requests(student_id);
CREATE INDEX idx_mentorship_mentor ON mentorship_requests(mentor_id);
CREATE INDEX idx_mentorship_status ON mentorship_requests(status);

CREATE TABLE job_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    posted_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    company VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    job_type job_type NOT NULL DEFAULT 'full_time',
    description TEXT NOT NULL,
    requirements TEXT,
    salary_range VARCHAR(100),
    application_url TEXT,
    application_deadline TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_job_posts_posted_by ON job_posts(posted_by);
CREATE INDEX idx_job_posts_type ON job_posts(job_type);
CREATE INDEX idx_job_posts_active ON job_posts(is_active) WHERE is_active = true;

CREATE TABLE job_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES job_posts(id) ON DELETE CASCADE,
    applicant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status application_status NOT NULL DEFAULT 'pending',
    cover_letter TEXT,
    resume_url TEXT,
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(job_id, applicant_id)
);

CREATE INDEX idx_job_applications_job ON job_applications(job_id);
CREATE INDEX idx_job_applications_applicant ON job_applications(applicant_id);
CREATE INDEX idx_job_applications_status ON job_applications(status);

CREATE TABLE alumni_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    event_type VARCHAR(50) NOT NULL DEFAULT 'networking', -- 'reunion', 'workshop', 'networking', 'seminar', 'career_fair'
    location VARCHAR(255),
    is_virtual BOOLEAN NOT NULL DEFAULT false,
    virtual_link TEXT,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    max_attendees INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alumni_events_type ON alumni_events(event_type);
CREATE INDEX idx_alumni_events_date ON alumni_events(start_date);

CREATE TABLE event_attendees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES alumni_events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rsvp_status VARCHAR(20) NOT NULL DEFAULT 'registered', -- 'registered', 'confirmed', 'attended', 'cancelled'
    registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(event_id, user_id)
);

CREATE INDEX idx_event_attendees_event ON event_attendees(event_id);
CREATE INDEX idx_event_attendees_user ON event_attendees(user_id);

-- ==================== TRIGGERS ====================

CREATE TRIGGER update_manuals_updated_at BEFORE UPDATE ON manuals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON groups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_skill_listings_updated_at BEFORE UPDATE ON skill_listings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alumni_status_updated_at BEFORE UPDATE ON alumni_status
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_job_posts_updated_at BEFORE UPDATE ON job_posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
