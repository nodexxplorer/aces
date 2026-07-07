export interface PaystackConfig {
  publicKey: string;
  amount: number;
  currency: string;
  reference: string;
  email: string;
  callbackUrl: string;
}

export const initializePaystackPayment = async (config: PaystackConfig): Promise<{ paymentUrl: string }> => {
  return { paymentUrl: `https://checkout.paystack.com/${config.reference}` };
};

export const verifyPaystackPayment = async (reference: string): Promise<{ status: string; amount: number }> => {
  return { status: 'completed', amount: 0 };
};

export const generatePaymentReference = (): string =>
  `ACES-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;