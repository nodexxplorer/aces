-- The department's short code in web addresses: /co is its student sign-in
-- page and /co/admin its admin sign-in page. Lowercase letters and digits, 2 to
-- 12 characters, unique across departments. NULL means the department has no
-- address yet. cmd/tenant sets it, and refuses the words the web app uses for
-- its own pages (see internal/tenant/urlcode.go).
ALTER TABLE tenants ADD COLUMN url_code VARCHAR(12);
ALTER TABLE tenants ADD CONSTRAINT tenants_url_code_format
    CHECK (url_code IS NULL OR url_code ~ '^[a-z0-9]{2,12}$');
ALTER TABLE tenants ADD CONSTRAINT tenants_url_code_key UNIQUE (url_code);

-- Existing departments take the department part of their matric code, lowercased:
-- EG/CO gives co. A code that two departments would share is left unset, so the
-- migration cannot fail on it; cmd/tenant update -url-code sets one by hand.
WITH candidates AS (
    SELECT id, lower(substring(matric_code FROM '/([A-Za-z0-9]{2,12})$')) AS code
    FROM tenants
    WHERE matric_code IS NOT NULL
),
unique_codes AS (
    SELECT code FROM candidates WHERE code IS NOT NULL GROUP BY code HAVING count(*) = 1
)
UPDATE tenants t
SET url_code = c.code
FROM candidates c
WHERE t.id = c.id
  AND t.url_code IS NULL
  AND c.code IN (SELECT code FROM unique_codes);
