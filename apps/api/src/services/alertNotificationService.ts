import { logger } from '../utils/logger';
import { recordAuditEvent } from './auditService';

export interface AlertNotification {
  userId: string;
  userEmail: string;
  alertType: string;
  productName: string;
  alertId: string;
  detail: string;
}

/**
 * Dispatch an alert notification.
 * Always records an in-app audit event.
 * Sends email when SMTP_HOST + SMTP_FROM are configured.
 */
export async function dispatchAlertNotification(n: AlertNotification): Promise<void> {
  await recordAuditEvent({
    userId: n.userId,
    action: 'alert.triggered',
    entityType: 'alert_subscription',
    entityId: n.alertId,
    summary: `${n.alertType} alert triggered for ${n.productName}: ${n.detail}`,
    metadata: { alertType: n.alertType, productName: n.productName, detail: n.detail },
  });

  logger.info(`Alert dispatched`, {
    userId: n.userId,
    alertId: n.alertId,
    alertType: n.alertType,
    productName: n.productName,
  });

  if (process.env.SMTP_HOST && process.env.SMTP_FROM) {
    await sendEmail(n);
  }
}

async function sendEmail(n: AlertNotification): Promise<void> {
  // Lazy-require nodemailer so the API still starts without it installed.
  let nodemailer: any;
  try {
    nodemailer = require('nodemailer');
  } catch {
    logger.warn('nodemailer not installed — skipping email notification');
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });

  const subject = alertSubject(n);
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: n.userEmail,
      subject,
      text: `${subject}\n\n${n.detail}\n\nView your cart at ${process.env.WEB_URL ?? 'http://localhost:3000'}/cart`,
    });
    logger.info(`Alert email sent to ${n.userEmail}`, { alertId: n.alertId });
  } catch (error) {
    logger.error(`Failed to send alert email: ${error}`);
  }
}

function alertSubject(n: AlertNotification): string {
  switch (n.alertType) {
    case 'price_drop': return `Price drop on ${n.productName}`;
    case 'restock': return `${n.productName} is back in stock`;
    case 'transfer_opportunity': return `Better price found for ${n.productName}`;
    case 'promo_expiration': return `Promo expiring soon for ${n.productName}`;
    case 'card_offer': return `Card offer available for ${n.productName}`;
    default: return `Alert for ${n.productName}`;
  }
}
