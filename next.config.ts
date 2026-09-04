import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "10.*",
    "10.*.*.*",
    "192.168.*",
    "192.168.*.*",
    "172.*",
    "*.local",
    "*.lan",
  ],
  compress: true,
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ["clsx", "tailwind-merge", "uuid", "@supabase/supabase-js"],
  },
};

export default nextConfig;
