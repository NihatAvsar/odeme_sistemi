import type { Response } from 'express';

type ReadinessDependency = {
  $queryRaw: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;
};

export function createReadinessHandler(prisma: ReadinessDependency) {
  return async (_req: unknown, res: Response) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ ok: true, dependencies: { database: 'ok' } });
    } catch {
      res.status(503).json({ ok: false, dependencies: { database: 'error' } });
    }
  };
}
