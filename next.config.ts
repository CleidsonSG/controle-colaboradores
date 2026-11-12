import type { NextConfig } from "next";

// GitHub Pages serves the site under /<repo>/; the workflow injects BASE_PATH at build time.
const basePath = process.env.BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
