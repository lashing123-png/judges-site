import { timingSafeEqual } from 'crypto';
import { syncIsrCompetitions } from '@/lib/isrSync';

// סנכרון יומי של תחרויות מאתר איגוד השחייה. מופעל ע"י Vercel Schedules (vercel.json),
// מוגן ב-CRON_SECRET: Vercel שולח "Authorization: Bearer <CRON_SECRET>".
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const got = Buffer.from(req.headers.get('authorization') ?? '');
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

export async function GET(req: Request) {
  if (!authorized(req)) return new Response('Unauthorized', { status: 401 });
  try {
    const summary = await syncIsrCompetitions(null);
    return Response.json({ ok: true, ...summary });
  } catch (e: any) {
    console.error('isr sync failed', e);
    return Response.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
