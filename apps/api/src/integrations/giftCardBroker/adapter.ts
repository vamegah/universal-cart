import { assertMockPaymentsAllowed } from '../../services/paymentModeService';
import axios from 'axios';

export interface GiftCardPurchase {
  code: string;
  pin?: string;
  balance: number;
  currency?: string;
  provider: string;
  brokerReference?: string;
  expiresAt?: string;
  fraudRisk?: 'low' | 'medium' | 'high' | 'unknown';
  buyerProtection?: {
    refundWindowDays?: number;
    replacementEligible?: boolean;
    termsUrl?: string;
  };
}

export interface GiftCardBrokerAdapter {
  purchaseGiftCard(retailerName: string, amount: number): Promise<GiftCardPurchase>;
}

function normalizeRetailerCode(retailerName: string) {
  return retailerName
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 20) || 'RETAILER';
}

function normalizeAmount(amount: number) {
  return Math.round(amount * 100) / 100;
}

export class MockGiftCardBrokerAdapter implements GiftCardBrokerAdapter {
  async purchaseGiftCard(retailerName: string, amount: number): Promise<GiftCardPurchase> {
    assertMockPaymentsAllowed('Mock gift card broker');

    const balance = normalizeAmount(amount);
    const cents = Math.round(balance * 100);
    const retailerCode = normalizeRetailerCode(retailerName);

    return {
      code: `MOCK-GC-${retailerCode}-${String(cents).padStart(8, '0')}`,
      pin: String((retailerCode.length * 97 + cents) % 10000).padStart(4, '0'),
      balance,
      currency: 'USD',
      provider: 'mock',
      brokerReference: `mock-gc-${retailerCode.toLowerCase()}-${cents}`,
      expiresAt: new Date(Date.UTC(2099, 11, 31)).toISOString(),
      fraudRisk: 'low',
      buyerProtection: {
        refundWindowDays: 0,
        replacementEligible: false,
        termsUrl: 'mock://gift-card-broker/terms',
      },
    };
  }
}

function requireBrokerConfig(value: string | undefined, name: string) {
  if (!value) throw new Error(`${name} is required for gift card broker integration`);
  return value;
}

function parseBrokerPurchaseResponse(data: any, amount: number): GiftCardPurchase {
  const code = String(data?.code || data?.redemptionCode || '').trim();
  if (!code) throw new Error('Gift card broker response did not include a redemption code');

  return {
    code,
    pin: data?.pin ? String(data.pin) : undefined,
    balance: normalizeAmount(Number(data?.balance ?? amount)),
    currency: String(data?.currency || 'USD'),
    provider: String(data?.provider || process.env.GIFT_CARD_BROKER_PROVIDER || 'http'),
    brokerReference: data?.brokerReference || data?.id || data?.reference,
    expiresAt: data?.expiresAt,
    fraudRisk: data?.fraudRisk || 'unknown',
    buyerProtection: data?.buyerProtection || {
      replacementEligible: true,
      termsUrl: data?.termsUrl,
    },
  };
}

export class HttpGiftCardBrokerAdapter implements GiftCardBrokerAdapter {
  async purchaseGiftCard(retailerName: string, amount: number): Promise<GiftCardPurchase> {
    const endpoint = requireBrokerConfig(process.env.GIFT_CARD_BROKER_URL, 'GIFT_CARD_BROKER_URL');
    const apiKey = requireBrokerConfig(process.env.GIFT_CARD_BROKER_API_KEY, 'GIFT_CARD_BROKER_API_KEY');
    const response = await axios.post(
      endpoint,
      {
        retailerName,
        amount: normalizeAmount(amount),
        currency: 'USD',
        buyerProtectionRequired: true,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: Number(process.env.GIFT_CARD_BROKER_TIMEOUT_MS || 10000),
      }
    );

    return parseBrokerPurchaseResponse(response.data, amount);
  }
}

export function getGiftCardBrokerAdapter(): GiftCardBrokerAdapter {
  if (process.env.ENABLE_MOCK_PAYMENTS === 'true') {
    return new MockGiftCardBrokerAdapter();
  }

  if ((process.env.GIFT_CARD_BROKER_PROVIDER || '').toLowerCase() === 'http') {
    return new HttpGiftCardBrokerAdapter();
  }

  if (process.env.GIFT_CARD_BROKER_URL && process.env.GIFT_CARD_BROKER_API_KEY) {
    return new HttpGiftCardBrokerAdapter();
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('Gift card broker is not configured');
  }

  return new MockGiftCardBrokerAdapter();
}
