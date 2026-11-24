import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev-only hosts allowed to load Next.js dev assets (including HMR).
  allowedDevOrigins: ["ironwolf.tk", "10.231.76.189", "127.0.0.1", "localhost"],
};

export default nextConfig;
