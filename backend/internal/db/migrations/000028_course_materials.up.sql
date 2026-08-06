-- Course Material Repository: lecturers upload slides/past questions/reading
-- materials per course; students (and staff) browse and download them.

CREATE TYPE course_material_type AS ENUM ('slide', 'past_question', 'reading', 'other');

CREATE TABLE course_materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES users(id),
    session_id UUID REFERENCES sessions(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    material_type course_material_type NOT NULL DEFAULT 'other',
    file_url VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size INTEGER NOT NULL DEFAULT 0,
    download_count INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_course_materials_course ON course_materials(course_id);
CREATE INDEX idx_course_materials_uploader ON course_materials(uploaded_by);
