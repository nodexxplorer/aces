-- Decouples "cover was printed" from "manual was physically collected" —
-- previously bulk-printing a cover immediately marked is_collected, which
-- conflated the two. printed_at now tracks the print step; is_collected
-- (set only by a staff QR scan at handover) tracks actual pickup.
ALTER TABLE manual_purchases ADD COLUMN printed_at TIMESTAMPTZ;
