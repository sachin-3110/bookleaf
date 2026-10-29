import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // NOTE: `cacheComponents` is intentionally NOT enabled.
  // This app is a fully dynamic, authenticated dashboard (reads cookies + MongoDB on every
  // request), so the Cache Components / PPR model would only add build friction here.
  // Keep the native-ish DB driver out of the bundler; load it from node_modules at runtime.
  serverExternalPackages: ["mongoose"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
