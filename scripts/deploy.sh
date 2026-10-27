#!/usr/bin/env bash
# Ships Convex functions to production, then the Next app to Vercel.
set -euo pipefail
cd "$(dirname "$0")/.."
npx convex deploy -y
npx vercel deploy --prod
