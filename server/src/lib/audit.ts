import type { Request } from 'express';
import { prisma } from './prisma.js';
import { createAuditLogger } from '../services/audit.service.js';

export const writeAuditLog = createAuditLogger(prisma);

export function getAuditRequestContext(req: Request) {
  return {
    ip: req.ip,
    userAgent: req.get('user-agent') ?? null,
  };
}
