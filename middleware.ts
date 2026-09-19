import { withAuth } from 'next-auth/middleware';

// כל עמוד מלבד התחברות והרשמה דורש התחברות. ההרשאות עצמן נבדקות בשרת (lib/authz.ts).
export default withAuth({ pages: { signIn: '/login' } });

export const config = {
  matcher: ['/((?!login|register|api/auth|_next/static|_next/image|favicon.ico).*)'],
};
