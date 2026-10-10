-- 000014_drop_department_login_look.up.sql
--
-- The sign-in look is now chosen on each person's own device (the template and
-- any image they upload), so the server no longer stores it. Removes the table
-- added in 000013.
DROP TABLE IF EXISTS department_login_looks;
