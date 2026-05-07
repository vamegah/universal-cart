export class RetailerRequestError extends Error {
  statusCode: number;
  retailerName: string;
  operation: string;

  constructor(retailerName: string, operation: string, message: string, statusCode = 502) {
    super(message);
    this.name = 'RetailerRequestError';
    this.statusCode = statusCode;
    this.retailerName = retailerName;
    this.operation = operation;
  }
}

type RetryOptions = {
  attempts?: number;
  timeoutMs?: number;
  retryDelayMs?: number;
};

function wait(ms: number) {
  return ms <= 0 ? Promise.resolve() : new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientError(error: any) {
  const status = Number(error?.response?.status);
  const code = String(error?.code || '');
  return (
    error instanceof RetailerRequestError ||
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNABORTED' ||
    status === 408 ||
    status === 429 ||
    status >= 500
  );
}

function toRetailerError(retailerName: string, operation: string, error: unknown) {
  if (error instanceof RetailerRequestError) return error;
  const message = error instanceof Error ? error.message : 'Retailer request failed';
  return new RetailerRequestError(retailerName, operation, `${operation} failed for ${retailerName}: ${message}`);
}

async function withTimeout<T>(operation: () => Promise<T>, timeoutMs: number, retailerName: string, operationName: string) {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new RetailerRequestError(retailerName, operationName, `${operationName} timed out for ${retailerName}`, 504));
    }, timeoutMs);
  });

  try {
    return await Promise.race([operation(), timeout]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

export async function runRetailerRequest<T>(
  retailerName: string,
  operationName: string,
  operation: () => Promise<T>,
  options: RetryOptions = {}
) {
  const attempts = Math.max(1, options.attempts ?? Number(process.env.RETAILER_REQUEST_ATTEMPTS || 2));
  const timeoutMs = Math.max(1, options.timeoutMs ?? Number(process.env.RETAILER_REQUEST_TIMEOUT_MS || 8000));
  const retryDelayMs = Math.max(0, options.retryDelayMs ?? Number(process.env.RETAILER_REQUEST_RETRY_DELAY_MS || 250));
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await withTimeout(operation, timeoutMs, retailerName, operationName);
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !isTransientError(error)) break;
      await wait(retryDelayMs);
    }
  }

  throw toRetailerError(retailerName, operationName, lastError);
}
