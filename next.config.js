/** @type {import('next').NextConfig} */
const nextConfig = {
  // Prevent Next.js from bundling these Node.js-only packages into the
  // serverless bundle. They are heavy, use native addons, and must be
  // loaded from node_modules at runtime — not traced/bundled at build time.
  serverExternalPackages: [
    'bullmq',
    'ioredis',
    'pdf-parse',
    'mammoth',
    'nodemailer',
    'sharp',
  ],
}

module.exports = nextConfig
