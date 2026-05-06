import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { realtimeGateway } from '../lib/realtime.js';

export const TABLE_RELEASE_DELAY_MS = 3 * 60 * 1000;

type ReleaseClient = Prisma.TransactionClient | typeof prisma;

function getReleaseAt(now = new Date()) {
  return new Date(now.getTime() + TABLE_RELEASE_DELAY_MS);
}

export async function scheduleTableCleanup(
  tableId: string,
  sessionId: string,
  now = new Date(),
  client: ReleaseClient = prisma,
) {
  const releaseAt = getReleaseAt(now);

  await client.tableSession.update({
    where: { id: sessionId },
    data: {
      status: 'CLOSED',
      closedAt: now,
    },
  });

  await client.table.update({
    where: { id: tableId },
    data: {
      status: 'CLEANING',
      releaseAt,
    },
  });

  realtimeGateway.emitToTable(tableId, 'table.updated', { tableId, status: 'CLEANING' });

  return releaseAt;
}

export async function releaseTableNow(tableId: string, now = new Date(), client: ReleaseClient = prisma) {
  const table = await client.table.findUnique({
    where: { id: tableId },
    include: {
      sessions: {
        where: { status: 'OPEN' },
        select: { id: true },
      },
    },
  });

  if (!table || table.status !== 'CLEANING') {
    return false;
  }

  if (table.sessions.length > 0) {
    await client.tableSession.updateMany({
      where: {
        id: { in: table.sessions.map((session) => session.id) },
      },
      data: {
        status: 'CLOSED',
        closedAt: now,
      },
    });
  }

  await client.table.update({
    where: { id: tableId },
    data: {
      status: 'AVAILABLE',
      releaseAt: null,
    },
  });

  realtimeGateway.emitToTable(tableId, 'table.updated', { tableId, status: 'AVAILABLE' });

  return true;
}

export async function releaseDueTables(now = new Date()) {
  const dueTables = await prisma.table.findMany({
    where: {
      status: 'CLEANING',
      releaseAt: { lte: now },
    },
    select: { id: true },
  });

  for (const table of dueTables) {
    await releaseTableNow(table.id, now);
  }

  return dueTables.length;
}

export async function releaseTableIfDue(tableId: string, now = new Date()) {
  const table = await prisma.table.findUnique({
    where: { id: tableId },
    select: { id: true, status: true, releaseAt: true },
  });

  if (!table || table.status !== 'CLEANING' || !table.releaseAt) {
    return false;
  }

  if (table.releaseAt > now) {
    return false;
  }

  return releaseTableNow(tableId, now);
}

let sweepStarted = false;

export function startTableReleaseSweeper() {
  if (sweepStarted) return;
  sweepStarted = true;

  const sweep = async () => {
    try {
      await releaseDueTables();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Table release sweep failed', error);
    }
  };

  void sweep();
  setInterval(() => {
    void sweep();
  }, 30_000);
}
