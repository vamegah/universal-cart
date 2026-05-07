import { Prisma } from '@prisma/client';
import { prisma } from '../index';

export interface SettlementEntryInput {
  userId: string;
  cartId: string;
  virtualCardTransactionId: string;
  retailerName: string;
  amount: number;
  currency?: string;
  platformFee?: number;
  metadata?: Record<string, unknown>;
}

export interface SettlementFailureInput {
  userId: string;
  cartId: string;
  virtualCardTransactionId: string;
  retailerName: string;
  amount: number;
  currency?: string;
  error: string;
  metadata?: Record<string, unknown>;
}

export interface SettlementRefundInput extends SettlementEntryInput {
  reason: string;
}

function assertMoneyAmount(amount: number, fieldName: string) {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(`${fieldName} must be a non-negative amount`);
  }
}

function roundMoney(amount: number) {
  return Math.round(amount * 100) / 100;
}

function ledgerMetadata(metadata: Record<string, unknown> = {}) {
  return metadata as Prisma.InputJsonValue;
}

export function buildSettlementEntries(input: SettlementEntryInput) {
  assertMoneyAmount(input.amount, 'amount');
  assertMoneyAmount(input.platformFee || 0, 'platformFee');

  if (input.amount <= 0) throw new Error('amount must be greater than 0');
  if ((input.platformFee || 0) > input.amount) {
    throw new Error('platformFee cannot exceed amount');
  }

  const currency = input.currency || 'USD';
  const platformFee = roundMoney(input.platformFee || 0);
  const retailerPayout = roundMoney(input.amount - platformFee);

  const base = {
    userId: input.userId,
    cartId: input.cartId,
    virtualCardTransactionId: input.virtualCardTransactionId,
    retailerName: input.retailerName,
    currency,
    status: 'posted',
    metadata: ledgerMetadata(input.metadata),
  };

  return [
    {
      ...base,
      entryType: 'platform_charge',
      amount: roundMoney(input.amount),
    },
    {
      ...base,
      entryType: 'retailer_payout',
      amount: -retailerPayout,
    },
    {
      ...base,
      entryType: 'platform_fee',
      amount: -platformFee,
    },
  ];
}

export function buildSettlementRefundEntries(input: SettlementRefundInput) {
  assertMoneyAmount(input.amount, 'amount');
  assertMoneyAmount(input.platformFee || 0, 'platformFee');

  if (input.amount <= 0) throw new Error('amount must be greater than 0');
  if ((input.platformFee || 0) > input.amount) {
    throw new Error('platformFee cannot exceed amount');
  }

  const currency = input.currency || 'USD';
  const platformFee = roundMoney(input.platformFee || 0);
  const retailerReversal = roundMoney(input.amount - platformFee);
  const metadata = ledgerMetadata({
    ...(input.metadata || {}),
    reason: input.reason,
  });

  const base = {
    userId: input.userId,
    cartId: input.cartId,
    virtualCardTransactionId: input.virtualCardTransactionId,
    retailerName: input.retailerName,
    currency,
    status: 'posted',
    metadata,
  };

  return [
    {
      ...base,
      entryType: 'refund',
      amount: -roundMoney(input.amount),
    },
    {
      ...base,
      entryType: 'retailer_payout_reversal',
      amount: retailerReversal,
    },
    {
      ...base,
      entryType: 'platform_fee_reversal',
      amount: platformFee,
    },
  ];
}

export function assertSettlementEntriesBalance(entries: Array<{ amount: number }>) {
  const total = entries.reduce((sum, entry) => sum + entry.amount, 0);
  if (Math.abs(roundMoney(total)) > 0) {
    throw new Error('Settlement ledger entries must balance to zero');
  }
}

export async function recordSettlementEntriesForCheckout(input: SettlementEntryInput) {
  const entries = buildSettlementEntries(input);
  assertSettlementEntriesBalance(entries);

  await (prisma as any).settlementLedgerEntry.createMany({
    data: entries,
  });

  return entries;
}

export async function recordSettlementRefund(input: SettlementRefundInput) {
  const entries = buildSettlementRefundEntries(input);
  assertSettlementEntriesBalance(entries);

  await (prisma as any).settlementLedgerEntry.createMany({
    data: entries,
  });

  return entries;
}

export async function recordSettlementFailure(input: SettlementFailureInput) {
  assertMoneyAmount(input.amount, 'amount');

  const entry = {
    userId: input.userId,
    cartId: input.cartId,
    virtualCardTransactionId: input.virtualCardTransactionId,
    retailerName: input.retailerName,
    entryType: 'failed_authorization',
    amount: 0,
    currency: input.currency || 'USD',
    status: 'failed',
    metadata: ledgerMetadata({
      ...(input.metadata || {}),
      attemptedAmount: roundMoney(input.amount),
      error: input.error,
    }),
  };

  await (prisma as any).settlementLedgerEntry.create({
    data: entry,
  });

  return entry;
}
