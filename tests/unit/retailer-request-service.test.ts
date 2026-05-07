import { describe, expect, it, jest } from '@jest/globals';
import { RetailerRequestError, runRetailerRequest } from '../../apps/api/src/services/retailerRequestService';

describe('retailerRequestService', () => {
  it('retries transient retailer failures before returning data', async () => {
    const operation = jest
      .fn<() => Promise<{ price: number }>>()
      .mockRejectedValueOnce(Object.assign(new Error('rate limited'), { response: { status: 429 } }))
      .mockResolvedValueOnce({ price: 19.99 });

    const result = await runRetailerRequest('Amazon', 'product import', operation, {
      attempts: 2,
      retryDelayMs: 0,
      timeoutMs: 1000,
    });

    expect(result).toEqual({ price: 19.99 });
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-transient parser failures', async () => {
    const operation = jest.fn<() => Promise<never>>().mockRejectedValue(new Error('Unable to parse metadata'));

    await expect(
      runRetailerRequest('Target', 'product import', operation, {
        attempts: 3,
        retryDelayMs: 0,
        timeoutMs: 1000,
      })
    ).rejects.toThrow('product import failed for Target: Unable to parse metadata');

    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('returns a typed timeout error for slow retailer operations', async () => {
    const operation = jest.fn<() => Promise<never>>(() => new Promise(() => undefined));

    await expect(
      runRetailerRequest('Walmart', 'product search', operation, {
        attempts: 1,
        timeoutMs: 5,
      })
    ).rejects.toMatchObject({
      name: 'RetailerRequestError',
      statusCode: 504,
      retailerName: 'Walmart',
      operation: 'product search',
    } satisfies Partial<RetailerRequestError>);
  });
});
