-- 000004_multi_tenancy.down.sql
--
-- Reverses 000004 by folding every tenant back into one shared dataset.
-- Only safe while a single tenant exists: uniqueness is restored without the
-- tenant column, so duplicates created by a second tenant will make this fail.

DROP FUNCTION IF EXISTS tenant_for_paystack_reference(TEXT);
DROP FUNCTION IF EXISTS tenant_for_unsubscribe_token(TEXT);
DROP FUNCTION IF EXISTS tenant_for_calendar_token(TEXT);

-- Receipt sequences come back, positioned after the tenant's last number.
CREATE SEQUENCE IF NOT EXISTS department_receipt_seq;
CREATE SEQUENCE IF NOT EXISTS class_receipt_seq;

SELECT setval('department_receipt_seq',
              GREATEST(COALESCE((SELECT value FROM tenant_counters WHERE name = 'department_receipt'), 0), 1),
              COALESCE((SELECT value FROM tenant_counters WHERE name = 'department_receipt'), 0) > 0);
SELECT setval('class_receipt_seq',
              GREATEST(COALESCE((SELECT value FROM tenant_counters WHERE name = 'class_receipt'), 0), 1),
              COALESCE((SELECT value FROM tenant_counters WHERE name = 'class_receipt'), 0) > 0);

DROP TABLE IF EXISTS tenant_counters;

CREATE OR REPLACE FUNCTION link_pending_results()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE results
    SET student_id = NEW.id
    WHERE matric_number = NEW.matric_number
      AND student_id IS NULL;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Composite (tenant_id, column) keys go back to single-column keys first:
-- dropping tenant_id below would otherwise silently drop them.
DO $$
DECLARE
    fk RECORD;
    action TEXT;
BEGIN
    FOR fk IN
        SELECT c.conname,
               c.conrelid::regclass::text AS from_tbl,
               c.confrelid::regclass::text AS to_tbl,
               af.attname AS from_col,
               at.attname AS to_col,
               c.confdeltype
        FROM pg_constraint c
        JOIN pg_attribute af ON af.attrelid = c.conrelid AND af.attnum = c.conkey[2]
        JOIN pg_attribute at ON at.attrelid = c.confrelid AND at.attnum = c.confkey[2]
        WHERE c.contype = 'f'
          AND c.connamespace = 'public'::regnamespace
          AND cardinality(c.conkey) = 2
          AND c.conkey[1] = (SELECT x.attnum FROM pg_attribute x
                             WHERE x.attrelid = c.conrelid AND x.attname = 'tenant_id')
    LOOP
        action := CASE fk.confdeltype
                      WHEN 'c' THEN ' ON DELETE CASCADE'
                      WHEN 'n' THEN ' ON DELETE SET NULL'
                      ELSE ''
                  END;
        EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', fk.from_tbl, fk.conname);
        EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %s (%I)%s',
                       fk.from_tbl, fk.conname, fk.from_col, fk.to_tbl, fk.to_col, action);
    END LOOP;

    -- Per-tenant reference keys added by 000004 (named *_tenant_<column>_key).
    FOR fk IN
        SELECT c.conrelid::regclass::text AS tbl, c.conname
        FROM pg_constraint c
        WHERE c.contype = 'u' AND c.connamespace = 'public'::regnamespace
          AND c.conname LIKE '%\_tenant\_%\_key'
    LOOP
        EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', fk.tbl, fk.conname);
    END LOOP;
END $$;

DO $$
DECLARE
    r RECORD;
    con RECORD;
    idx RECORD;
BEGIN
    FOR r IN
        SELECT c.relname AS tbl
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r'
          AND EXISTS (SELECT 1 FROM pg_attribute a
                      WHERE a.attrelid = c.oid AND a.attname = 'tenant_id' AND NOT a.attisdropped)
          AND c.relname <> 'tenants'
    LOOP
        FOR con IN
            SELECT conname, pg_get_constraintdef(oid) AS def
            FROM pg_constraint
            WHERE conrelid = r.tbl::regclass AND contype = 'u'
        LOOP
            EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', r.tbl, con.conname);
            EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I %s', r.tbl, con.conname,
                           replace(con.def, 'UNIQUE (tenant_id, ', 'UNIQUE ('));
        END LOOP;

        FOR idx IN
            SELECT c.relname AS idx_name, pg_get_indexdef(i.indexrelid) AS def
            FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
            WHERE i.indrelid = r.tbl::regclass AND i.indisunique AND NOT i.indisprimary
              AND NOT EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conindid = i.indexrelid)
        LOOP
            EXECUTE format('DROP INDEX %I', idx.idx_name);
            EXECUTE replace(idx.def, 'USING btree (tenant_id, ', 'USING btree (');
        END LOOP;

        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', r.tbl);
        EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', r.tbl);
        EXECUTE format('ALTER TABLE %I DROP COLUMN tenant_id', r.tbl);
    END LOOP;
END $$;

DROP FUNCTION IF EXISTS app_current_tenant();
DROP TABLE IF EXISTS tenants;
