-- Bounds the signature's rendered height, alongside the existing width_pt,
-- so a signature is scaled to fit inside its signing box on both
-- dimensions instead of only being width-constrained.
ALTER TABLE crf_signature_assets ADD COLUMN IF NOT EXISTS max_height_pt NUMERIC NOT NULL DEFAULT 0;
