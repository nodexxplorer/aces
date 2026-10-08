-- Official receipts for department/class dues payments.
--
-- Receipt numbers are handed out lazily (the first time a receipt PDF is
-- generated for a payment), not when the payment completes — this mirrors a
-- paper receipt book: numbers are only consumed when a receipt is actually
-- issued, so failed/abandoned payments never burn numbers.
--
-- department_receipt_seq / class_receipt_seq hand out the NO. on the receipt
-- face. The serial in the filename is payments.id (a UUID already shown on
-- the history page), which lets /payments/:id/receipt be a permanent,
-- guessable-free URL without exposing the sequential number in links.

CREATE SEQUENCE IF NOT EXISTS department_receipt_seq;
CREATE SEQUENCE IF NOT EXISTS class_receipt_seq;

ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS receipt_number INTEGER;
