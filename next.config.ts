import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    /** Tells an open app a newer deploy is live (src/lib/freshness.ts). */
    // One value per deploy: Date.now() alone can differ between the build's worker processes.
    NEXT_PUBLIC_BUILD: process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_GIT_COMMIT_SHA || Date.now().toString(36),
  },
};

export default nextConfig;
