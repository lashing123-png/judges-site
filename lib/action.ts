export type ActionResult = { ok: boolean; message: string };

// שגיאה שמותר להציג למשתמש/ת כמו שהיא
export class UserError extends Error {}

export async function run(fn: () => Promise<string | void>): Promise<ActionResult> {
  try {
    const msg = await fn();
    return { ok: true, message: msg || 'נשמר' };
  } catch (e: any) {
    // redirect() של Next נזרק כשגיאה ויש להעביר אותו הלאה
    if (e && typeof e.digest === 'string' && e.digest.startsWith('NEXT_REDIRECT')) throw e;
    if (e instanceof UserError) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: 'אירעה שגיאה. נסו שוב.' };
  }
}
