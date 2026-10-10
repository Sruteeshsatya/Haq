import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next bundles the browser build of the Cline SDK by default, which cannot run the agent.
  // Keep these as plain Node requires on the server.
  serverExternalPackages: ["@cline/sdk", "@cline/core", "@cline/agents", "@cline/llms", "@cline/shared", "exifr", "ics"],
  cacheComponents: true,
  partialPrefetching: true,
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
