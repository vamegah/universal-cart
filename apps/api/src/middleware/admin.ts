import { NextFunction, Request, Response } from 'express';
import { prisma } from '../index';
import { AuthenticatedRequest } from './auth';

function configuredAdminEmails() {
  return new Set(
    String(process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const { userId } = req as AuthenticatedRequest;
  const admins = configuredAdminEmails();

  if (admins.size === 0) {
    return res.status(403).json({ error: 'Admin access is not configured' });
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user || !admins.has(user.email.toLowerCase())) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  return next();
}
