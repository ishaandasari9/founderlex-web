import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/api/generate': ['./lib/templates/**'],
  },
  serverExternalPackages: ['pdfkit', 'html-to-docx'],
};

export default nextConfig;
