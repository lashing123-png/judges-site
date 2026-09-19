'use server';

import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { assertUser } from '@/lib/authz';
import { audit } from '@/lib/audit';
import { run, UserError, type ActionResult } from '@/lib/action';

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const intOrNull = (v: string) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
};

// שופט/ת עורך/ת פרטי קשר של עצמו/ה. שדות הניסיון והשם נעולים לאדמין.
export async function updateProfile(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const me = await assertUser();
    const userId = str(fd, 'userId');
    if (userId !== me.id && !me.isAdmin) throw new UserError('אין הרשאה לפעולה זו');
    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) throw new UserError('המשתמש/ת לא נמצא/ה');

    const data: Record<string, unknown> = {
      club: str(fd, 'club'),
      phone: str(fd, 'phone'),
      seniorityYear: intOrNull(str(fd, 'seniorityYear')),
      seniorityMonth: intOrNull(str(fd, 'seniorityMonth')),
    };

    const email = str(fd, 'email').toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new UserError('כתובת מייל לא תקינה');
    if (email !== target.email) {
      if (await prisma.user.findUnique({ where: { email } })) throw new UserError('כתובת המייל כבר בשימוש');
      data.email = email;
    }

    if (me.isAdmin) {
      const fn = str(fd, 'firstName');
      const ln = str(fd, 'lastName');
      if (!fn || !ln) throw new UserError('יש להזין שם פרטי ושם משפחה');
      Object.assign(data, {
        firstName: fn,
        lastName: ln,
        roleExperience: str(fd, 'roleExperience'),
        courses: str(fd, 'courses'),
        internationalComps: str(fd, 'internationalComps'),
      });
    }

    await prisma.user.update({ where: { id: userId }, data });
    if (me.isAdmin && userId !== me.id) await audit(me.id, 'עריכת כרטיס שופט/ת', `${target.firstName} ${target.lastName}`);
    revalidatePath('/profile');
    revalidatePath(`/profile/${userId}`);
    return 'הפרטים נשמרו';
  });
}

export async function changePassword(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const me = await assertUser();
    const current = String(fd.get('current') ?? '');
    const next = String(fd.get('next') ?? '');
    const confirm = String(fd.get('confirm') ?? '');
    if (!(await bcrypt.compare(current, me.passwordHash))) throw new UserError('הסיסמה הנוכחית שגויה');
    if (next.length < 8) throw new UserError('הסיסמה החדשה חייבת להכיל לפחות 8 תווים');
    if (next !== confirm) throw new UserError('הסיסמאות אינן זהות');
    await prisma.user.update({ where: { id: me.id }, data: { passwordHash: await bcrypt.hash(next, 12) } });
    return 'הסיסמה עודכנה';
  });
}
