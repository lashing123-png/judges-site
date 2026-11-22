/** @type {import('next').NextConfig} */
const nextConfig = {
  // בדיקת טיפוסים פעילה בזמן build (`npm run typecheck` עובר נקי).
  // ייבוא שופטים מקובץ: ברירת המחדל ל-Server Actions היא 1MB. הקובץ עצמו מוגבל ל-4MB בקוד.
  experimental: { serverActions: { bodySizeLimit: '4.5mb' } },
};
export default nextConfig;
