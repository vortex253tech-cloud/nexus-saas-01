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
    '@napi-rs/canvas',
  ],
  // Next's file tracer can't see fs.readFileSync('assets/fonts/...') calls
  // statically — without this, the font files used to render Instagram
  // post overlays wouldn't ship in the deployed serverless function.
  outputFileTracingIncludes: {
    '/api/cron/instagram-daily-post': ['./assets/fonts/*.ttf'],
  },
}

module.exports = nextConfig
