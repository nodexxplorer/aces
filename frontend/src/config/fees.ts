// Naira fees added by the payment flows. Keep in step with
// backend/internal/api/fees.go, which applies the same amounts on the server.

/** Paid once per regular course form, before the student can sign it. */
export const CRF_SIGNING_FEE = 200;

/** Added per dues item in the checkout cart. */
export const DUES_CHECKOUT_CHARGE = 300;
