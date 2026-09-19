import { prisma } from './prisma';

export async function audit(actorId: string | null, action: string, detail = '') {
  try {
    await prisma.auditLog.create({ data: { actorId, action, detail } });
  } catch (e) {
    console.error('audit failed', e);
  }
}
