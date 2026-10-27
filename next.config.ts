import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    /** Tells an open app a newer deploy is live (src/lib/freshness.ts). */
    NEXT_PUBLIC_BUILD: process.env.VERCEL_GIT_COMMIT_SHA || Date.now().toString(36),
  },
};

export default nextConfig;
