DROP SEQUENCE IF EXISTS department_receipt_seq;
DROP SEQUENCE IF EXISTS class_receipt_seq;

ALTER TABLE payments
    DROP COLUMN IF EXISTS receipt_number;
