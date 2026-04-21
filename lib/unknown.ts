export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function getString(value: Record<string, unknown>, key: string): string | undefined {
  const item = value[key]
  return typeof item === "string" ? item : undefined
}

export function getBoolean(value: Record<string, unknown>, key: string): boolean | undefined {
  const item = value[key]
  return typeof item === "boolean" ? item : undefined
}

export function getNumber(value: Record<string, unknown>, key: string): number | undefined {
  const item = value[key]
  return typeof item === "number" && Number.isFinite(item) ? item : undefined
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const parsed: unknown = await request.json()
    return isRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}
