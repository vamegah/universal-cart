/**
 * Secrets bootstrap.
 *
 * In production (NODE_ENV=production) this module attempts to pull secrets
 * from AWS Secrets Manager and inject them into process.env before the app
 * starts. Each secret is a JSON object stored under a path like
 * `universal-cart/<name>`.
 *
 * Required IAM permissions for the task/instance role:
 *   secretsmanager:GetSecretValue on arn:aws:secretsmanager:<region>:<account>:secret:universal-cart/*
 *
 * In development and CI the module is a no-op — secrets come from .env files.
 *
 * Secret names → env var mappings are defined in SECRET_MAP below.
 * Add new secrets here as the app grows.
 */

import { logger } from './logger';

function runtimeRequire(moduleName: string): any {
  return require(moduleName);
}

interface SecretMapping {
  secretName: string;
  envKeys: string[];
}

// Each entry maps one Secrets Manager secret (a JSON object) to the env var
// keys it should populate.  The secret value must be a JSON object whose keys
// match the envKeys listed here.
const SECRET_MAP: SecretMapping[] = [
  {
    secretName: 'universal-cart/database',
    envKeys: ['DATABASE_URL'],
  },
  {
    secretName: 'universal-cart/auth',
    envKeys: ['AUTH_SECRET'],
  },
  {
    secretName: 'universal-cart/smtp',
    envKeys: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'],
  },
  {
    secretName: 'universal-cart/stripe',
    envKeys: ['STRIPE_SECRET_KEY'],
  },
  {
    secretName: 'universal-cart/retailer-keys',
    envKeys: ['AMAZON_PA_API_KEY', 'WALMART_API_KEY'],
  },
];

async function fetchSecret(
  client: any,
  secretName: string
): Promise<Record<string, string> | null> {
  try {
    const { GetSecretValueCommand } = runtimeRequire('@aws-sdk/client-secrets-manager');
    const response = await client.send(new GetSecretValueCommand({ SecretId: secretName }));
    const raw = response.SecretString;
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error: any) {
    // ResourceNotFoundException is expected for optional secrets not yet created.
    if (error?.name === 'ResourceNotFoundException') {
      logger.warn(`Secret not found in Secrets Manager: ${secretName}`);
      return null;
    }
    logger.error(`Failed to fetch secret ${secretName}: ${error?.message}`);
    return null;
  }
}

export async function bootstrapSecrets(): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    // Dev / CI: secrets come from .env — nothing to do.
    return;
  }

  let SecretsManagerClient: any;
  try {
    ({ SecretsManagerClient } = runtimeRequire('@aws-sdk/client-secrets-manager'));
  } catch {
    logger.warn(
      '@aws-sdk/client-secrets-manager is not installed. ' +
        'Secrets will be read from environment variables only. ' +
        'Run: npm install @aws-sdk/client-secrets-manager --workspace @universal-cart/api'
    );
    return;
  }

  const region = process.env.AWS_REGION || 'us-east-1';
  const client = new SecretsManagerClient({ region });

  logger.info(`Loading secrets from AWS Secrets Manager (region: ${region})`);

  await Promise.all(
    SECRET_MAP.map(async ({ secretName, envKeys }) => {
      const values = await fetchSecret(client, secretName);
      if (!values) return;

      for (const key of envKeys) {
        if (values[key] !== undefined && !process.env[key]) {
          // Only set if not already provided by the environment (env wins).
          process.env[key] = String(values[key]);
        }
      }
    })
  );

  logger.info('Secrets bootstrap complete');
}
