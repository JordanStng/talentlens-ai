import type { NextConfig } from "next";

// Adresse der FastAPI (LangChain-Pipeline). Lokal Port 8000; beim Hosting
// per Env-Variable auf die deployte Backend-URL zeigen.
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  experimental: {
    // Bulk-Upload und Analyse rufen pro PDF das LLM auf und koennen laenger
    // dauern als die Standard-30s des Proxys. Ohne diese Erhoehung kappt der
    // Proxy die Verbindung ("socket hang up"), obwohl das Backend noch
    // erfolgreich weiterarbeitet.
    proxyTimeout: 180_000,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
