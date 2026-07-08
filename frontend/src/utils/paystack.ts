export interface PaystackConfig {
  publicKey: string;
  amount: number;
  currency: string;
  reference: string;
  email: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}

declare global {
  interface Window {
    PaystackPop: {
      setup: (config: {
        key: string;
        email: string;
        amount: number;
        currency: string;
        ref: string;
        callback: (response: { reference: string; trans: string; status: string }) => void;
        onClose: () => void;
        metadata?: Record<string, unknown>;
      }) => { openIframe: () => void };
    };
  }
}

export const initializePaystackPayment = async (config: PaystackConfig): Promise<{ paymentUrl: string }> => {
  const paymentUrl = `https://checkout.paystack.com/${config.reference}`;
  return { paymentUrl };
};

export const openPaystackPopup = (config: PaystackConfig): void => {
  if (typeof window.PaystackPop !== 'undefined') {
    const handler = window.PaystackPop.setup({
      key: config.publicKey,
      email: config.email,
      amount: config.amount * 100,
      currency: config.currency,
      ref: config.reference,
      metadata: config.metadata,
      callback: () => {
        window.location.href = config.callbackUrl;
      },
      onClose: () => {
      },
    });
    handler.openIframe();
  } else {
    window.location.href = `https://checkout.paystack.com/${config.reference}`;
  }
};

export const verifyPaystackPayment = async (reference: string): Promise<{ status: string; amount: number }> => {
  const response = await fetch(`/api/payments/verify?reference=${reference}`);
  if (!response.ok) throw new Error('Verification failed');
  return response.json();
};

export const generatePaymentReference = (): string =>
  `ACES-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
