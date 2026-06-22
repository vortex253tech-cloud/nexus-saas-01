import type { MetadataRoute } from 'next'

const BASE_URL = 'https://nexusaas.com.br'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  return [
    { url: `${BASE_URL}/`,            lastModified: now, changeFrequency: 'weekly',  priority: 1 },
    { url: `${BASE_URL}/planos`,      lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/termos`,      lastModified: now, changeFrequency: 'yearly',  priority: 0.2 },
    { url: `${BASE_URL}/privacidade`, lastModified: now, changeFrequency: 'yearly',  priority: 0.2 },
  ]
}
