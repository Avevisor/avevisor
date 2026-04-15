import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** WebSocket client used by delegate `botswap` listener on the server. */
  serverExternalPackages: ["ws"],
};

export default nextConfig;
