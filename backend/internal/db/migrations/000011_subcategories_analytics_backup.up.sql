-- ============================================================
-- Universal subcategories table (replaces course-specific only)
-- ============================================================
CREATE TYPE subcategory_module AS ENUM (
    'courses', 'dues', 'skills', 'events', 'announcements', 'jobs', 'groups'
);

CREATE TABLE subcategories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    module subcategory_module NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    color VARCHAR(20) DEFAULT '#6366f1',
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_subcategories_module ON subcategories(module);
CREATE INDEX idx_subcategories_active ON subcategories(is_active);

-- ============================================================
-- Subcategory assignments (links subcategories to entities)
-- ============================================================
CREATE TABLE subcategory_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subcategory_id UUID NOT NULL REFERENCES subcategories(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_by UUID REFERENCES users(id),
    UNIQUE(subcategory_id, entity_type, entity_id)
);
CREATE INDEX idx_subcategory_assignments_entity ON subcategory_assignments(entity_type, entity_id);

-- ============================================================
-- Analytics snapshots (periodic snapshots for trends)
-- ============================================================
CREATE TABLE analytics_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    snapshot_date DATE NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    metric_value NUMERIC NOT NULL,
    dimension JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_analytics_snapshots_date_metric ON analytics_snapshots(snapshot_date, metric_name);
CREATE INDEX idx_analytics_snapshots_name ON analytics_snapshots(metric_name);

-- ============================================================
-- Reports table (generated report metadata)
-- ============================================================
CREATE TYPE report_status AS ENUM ('generating', 'completed', 'failed');

CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    report_type VARCHAR(50) NOT NULL,
    format VARCHAR(20) NOT NULL DEFAULT 'pdf',
    file_url TEXT,
    status report_status NOT NULL DEFAULT 'generating',
    generated_by UUID REFERENCES users(id),
    parameters JSONB DEFAULT '{}',
    row_count INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);
CREATE INDEX idx_reports_type ON reports(report_type);
CREATE INDEX idx_reports_status ON reports(status);

-- ============================================================
-- Scheduled reports
-- ============================================================
CREATE TYPE scheduled_frequency AS ENUM ('daily', 'weekly', 'monthly', 'semester');

CREATE TABLE scheduled_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    report_type VARCHAR(50) NOT NULL,
    format VARCHAR(20) NOT NULL DEFAULT 'pdf',
    frequency scheduled_frequency NOT NULL,
    recipients JSONB NOT NULL DEFAULT '[]',
    parameters JSONB DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_run TIMESTAMPTZ,
    next_run TIMESTAMPTZ,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_scheduled_reports_active ON scheduled_reports(is_active);
