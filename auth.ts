'use server';

import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { run, UserError, type ActionResult } from '@/lib/action';

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();

// הרשמה עצמית: נוצר חשבון במצב PENDING. אי אפשר להתחבר עד שאדמין מאשר/ת.
export async function registerAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    // שדה "מלכודת" לבוטים: משתמש אמיתי לא רואה אותו ולא ממלא אותו
    if (str(fd, 'website')) return 'הבקשה נשלחה.';

    const email = str(fd, 'email').toLowerCase();
    const firstName = str(fd, 'firstName');
    const lastName = str(fd, 'lastName');
    const password = String(fd.get('password') ?? '');
    const confirm = String(fd.get('confirm') ?? '');

    if (!firstName || !lastName) throw new UserError('יש להזין שם פרטי ושם משפחה');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new UserError('כתובת מייל לא תקינה');
    if (password.length < 8) throw new UserError('הסיסמה חייבת להכיל לפחות 8 תווים');
    if (password !== confirm) throw new UserError('הסיסמאות אינן זהות');
    if (await prisma.user.findUnique({ where: { email } })) throw new UserError('כתובת המייל כבר רשומה במערכת');

    await prisma.user.create({
      data: {
        email,
        firstName,
        lastName,
        club: str(fd, 'club'),
        phone: str(fd, 'phone'),
        passwordHash: await bcrypt.hash(password, 12),
        status: 'PENDING',
      },
    });
    return 'הבקשה נשלחה. תוכלו להתחבר לאחר שמנהל/ת המערכת יאשר את החשבון.';
  });
}
