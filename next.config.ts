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
};

export default nextConfig;
