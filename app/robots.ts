import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard', '/admin', '/api', '/onboarding', '/setup', '/start', '/v1', '/login', '/signup'],
    },
    sitemap: 'https://nexusaas.com.br/sitemap.xml',
  }
}
