export const ROLE_OPTIONS = [
  'שופט/ת ראשי/ת',
  'מזניק/ה',
  'שופט/ת ראשי/ת ומזניק/ה',
  'סגנון',
  'הצבות',
  'מודד/ת זמנים',
  'פניות',
  'שופט זמן ראשי ודירוג',
  'שופט/ת פניות ראשי',
  'רזרבה',
];

// תפקידים/הסמכות שאפשר לסמן בכרטיס השופט/ת ("ניסיון בתפקידים"). בחירה מרשימה, לא הקלדה חופשית.
export const EXPERIENCE_ROLES = [
  'מודד זמן',
  'שופט פניות',
  'שופט סגנון',
  'מציב',
  'שופט ראשי ליגה',
  'שופט ראשי מחוזי',
  'שופט ראשי ארצי',
  'שופט ראשי בינ"ל',
  'מזניק מחוזי',
  'מזניק ארצי',
  'מזניק בינ"ל',
];

// נשמר בעמודת roleExperience כטקסט, תפקיד בכל שורה.
export const parseExperienceRoles = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);
export const serializeExperienceRoles = (roles: string[]) =>
  EXPERIENCE_ROLES.filter((r) => roles.includes(r)).join('\n');
