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
    printed_at TIMESTAMPTZ,
    UNIQUE(student_id, manual_id)
);

CREATE INDEX idx_manual_purchases_student ON manual_purchases(student_id);
CREATE INDEX idx_manual_purchases_manual ON manual_purchases(manual_id);

CREATE TABLE manual_print_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_id UUID NOT NULL REFERENCES manual_purchases(id),
    student_id UUID NOT NULL REFERENCES students(id),
    manual_id UUID NOT NULL REFERENCES manuals(id),
    status VARCHAR(20) NOT NULL DEFAULT 'queued',
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
    enrolled_via VARCHAR(20) NOT NULL DEFAULT 'qr_scan',
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(student_id, course_id, session_id)
);

CREATE INDEX idx_practical_enrollments_student ON practical_enrollments(student_id);
CREATE INDEX idx_practical_enrollments_course ON practical_enrollments(course_id);
