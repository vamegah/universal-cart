import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { logger } from '../utils/logger';

export interface RequestWithContext extends Request {
  requestId: string;
}

export function requestContext(req: Request, res: Response, next: NextFunction) {
  const incomingRequestId = req.headers['x-request-id'];
  const requestId =
    typeof incomingRequestId === 'string' && incomingRequestId.trim()
      ? incomingRequestId.trim()
      : crypto.randomUUID();

  (req as RequestWithContext).requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  const startedAt = Date.now();
  res.on('finish', () => {
    logger.info('http_request', {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
    });
  });

  next();
}
