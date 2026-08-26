import { config } from '../config/app.config';

export interface CreateBachsProductParams {
  name: string;
  description?: string;
  price: {
    price_type: 'fixed';
    amount: string;
    currency: string;
  };
}

export interface BachsCheckoutLineItem {
  product_id: string;
  quantity: number;
}

export interface CreateBachsCheckoutParams {
  product_cart: BachsCheckoutLineItem[];
  customer: {
    email: string;
    name: string;
  };
  return_url: string;
  cancel_url: string;
  reference?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
  billing_currency?: string;
  allowed_payment_method_types?: string[];
}

export interface BachsCheckoutSession {
  checkout_url: string;
  checkout_id: string;
  expires_at: string;
  reference?: string;
}

class BachsProvider {
  products = {
    create: (params: CreateBachsProductParams): Promise<{ id: string }> =>
      this.request('/v1/products', { method: 'POST', body: JSON.stringify(params) }),
  };

  checkout = {
    create: (params: CreateBachsCheckoutParams): Promise<BachsCheckoutSession> => {
      const { idempotencyKey, ...rest } = params;
      const headers: Record<string, string> = {};
      if (idempotencyKey) {
        headers['Idempotency-Key'] = idempotencyKey;
      }
      return this.request('/v1/checkout-sessions', {
        method: 'POST',
        body: JSON.stringify(rest),
        headers,
      });
    },
  };

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!config.bachs.apiKey) {
      throw new Error('BACHS_API_KEY is not set. Check your .env file.');
    }
    const res = await fetch(`${config.bachs.baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.bachs.apiKey}`,
        ...(init.headers ?? {}),
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Bachs API error ${res.status}: ${body}`);
    }
    return res.json() as Promise<T>;
  }
}

export const bachs = new BachsProvider();
