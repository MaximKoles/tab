import type { NextConfig } from "next";

// Обычный запуск (dev/превью): standalone-сервер.
// Экспорт статики для GitHub Pages:  EXPORT=1 NEXT_PUBLIC_BASE_PATH=/имя-репозитория bun run build
//   → готовая статика в папке out/ (см. DEPLOY.md)
const nextConfig: NextConfig = {
  output: process.env.EXPORT ? "export" : "standalone",
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  images: { unoptimized: true },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
