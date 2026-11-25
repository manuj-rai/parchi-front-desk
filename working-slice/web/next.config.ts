import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build to static files in web/out. The Python server serves them at /, so the demo
  // runs from one command. `npm run dev` still works for live editing.
  output: "export",
  // The intro page is at / and the console at /demo/. A trailing slash makes the export
  // write demo/index.html, which the Python server's static mount finds without help.
  trailingSlash: true,
  images: { unoptimized: true },
  turbopack: {
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
};

export default nextConfig;
