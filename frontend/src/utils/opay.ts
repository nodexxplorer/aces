export interface OpayConfig {
  merchantId: string;
  publicKey: string;
  amount: number;
  currency: string;
  reference: string;
  email: string;
  callbackUrl: string;
}

export const initializeOpayPayment = async (config: OpayConfig): Promise<{ paymentUrl: string }> => {
  return { paymentUrl: `https://pay.opay-inc.com/checkout?ref=${config.reference}` };
};

export const verifyOpayPayment = async (reference: string): Promise<{ status: string; amount: number }> => {
  return { status: 'completed', amount: 0 };
};

export const generatePaymentReference = (): string =>
  `ACES-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
