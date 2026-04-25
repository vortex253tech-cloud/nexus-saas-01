// Server-side AI service layer.
// Wraps the raw Anthropic/OpenAI calls so API routes stay thin.
// All functions here are server-only — never import in client components.

export { generateAIAnalysis, generateAIAlerts, generateWhatsAppReply } from '@/lib/ai'
