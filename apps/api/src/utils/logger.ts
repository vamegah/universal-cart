import winston from 'winston';

const SENSITIVE_KEY_PATTERN = /(authorization|password|token|cardToken|cardNumber|cvv|cvc|pan|secret)/i;

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((entry) => redact(entry));
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      SENSITIVE_KEY_PATTERN.test(key) ? '[redacted]' : redact(entry),
    ])
  );
}

const redactFormat = winston.format((info) => redact(info) as winston.Logform.TransformableInfo);

const level = process.env.LOG_LEVEL || 'info';

// In production / containers (NODE_ENV=production or LOG_TO_FILE=false) emit
// structured JSON to stdout only so the container runtime / CloudWatch can
// collect logs without needing filesystem access.
const isProduction = process.env.NODE_ENV === 'production';
const logToFile = process.env.LOG_TO_FILE !== 'false' && !isProduction;

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: isProduction
      ? winston.format.combine(winston.format.timestamp(), redactFormat(), winston.format.json())
      : winston.format.combine(
          winston.format.timestamp(),
          redactFormat(),
          winston.format.colorize(),
          winston.format.simple()
        ),
  }),
];

if (logToFile) {
  transports.push(
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  );
}

export const logger = winston.createLogger({
  level,
  format: winston.format.combine(winston.format.timestamp(), redactFormat(), winston.format.json()),
  transports,
});
