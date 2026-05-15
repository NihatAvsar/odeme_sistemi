import type { PrismaClient } from '@prisma/client';

const sensitiveKeyPattern = /password|token|secret|card|cvv|cvc|pan|authorization|cookie|session/i;

type AuditPayload = Record<string, unknown> | null | undefined;

export type AuditLogInput = {
  restaurantId?: string | null;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  payload?: AuditPayload;
  ip?: string | null;
  userAgent?: string | null;
};

function sanitizeValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !sensitiveKeyPattern.test(key))
      .map(([key, childValue]) => [key, sanitizeValue(childValue)]),
  );
}

export function sanitizeAuditPayload(payload: AuditPayload) {
  if (!payload) return undefined;
  return sanitizeValue(payload) as Record<string, unknown>;
}

export function createAuditLogger(prisma: Pick<PrismaClient, 'auditLog'>) {
  return async function writeAuditLog(input: AuditLogInput) {
    try {
      await prisma.auditLog.create({
        data: {
          restaurantId: input.restaurantId ?? undefined,
          actorId: input.actorId ?? undefined,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId ?? undefined,
          payload: sanitizeAuditPayload({
            ...(input.payload ?? {}),
            ...(input.ip ? { ip: input.ip } : {}),
            ...(input.userAgent ? { userAgent: input.userAgent } : {}),
          }) as never,
        },
      });
    } catch (error) {
      console.error('Audit log write failed', error);
    }
  };
}
