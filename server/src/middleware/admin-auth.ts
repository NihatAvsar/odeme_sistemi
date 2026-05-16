import type { NextFunction, Request, Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';

export function isValidAdminSecret(secret: string | undefined) {
  if (!secret || !env.adminSecret) return false;
  const received = Buffer.from(secret);
  const expected = Buffer.from(env.adminSecret);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const secret = req.header('x-admin-secret');

  if (!isValidAdminSecret(secret)) {
    res.status(401).json({ message: 'Unauthorized admin access' });
    return;
  }

  next();
}

export function hasAdminAuth(req: Request, res: Response) {
  const secret = req.header('x-admin-secret');
  if (!isValidAdminSecret(secret)) {
    res.status(401).json({ message: 'Unauthorized admin access' });
    return false;
  }

  return true;
}
