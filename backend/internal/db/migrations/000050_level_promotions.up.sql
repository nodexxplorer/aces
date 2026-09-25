-- Session roll-over with HOD-confirmed batch promotion.
-- Levels are no longer derived from results (which are on hold); instead,
-- when a new session starts, the system proposes each student's outcome
-- (promote to level+100, or carryover) based on cycle completion
-- (dues paid + CRF signed or courses registered). HOD/admin reviews the
-- proposal per level, may flip individual students, then confirms the
-- batch — which atomically bumps levels and rolls students into the new
-- session.
CREATE TABLE level_promotions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    from_session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
    to_session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    from_level INT NOT NULL,
    to_level INT NOT NULL,
    -- 'proposed' -> 'confirmed' | 'held_back' | 'carried_over'
    status VARCHAR(20) NOT NULL DEFAULT 'proposed'
        CHECK (status IN ('proposed', 'confirmed', 'held_back', 'carried_over')),
    -- How eligibility was determined, e.g. 'dues_crf', 'dues_registration',
    -- 'manual_advance', 'carryover'
    reason VARCHAR(30) NOT NULL DEFAULT 'carryover',
    confirmed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- One proposal per student per roll-over.
    UNIQUE (student_id, to_session_id)
);

CREATE INDEX idx_level_promotions_session ON level_promotions(to_session_id);
CREATE INDEX idx_level_promotions_status ON level_promotions(status);
CREATE INDEX idx_level_promotions_student ON level_promotions(student_id);
