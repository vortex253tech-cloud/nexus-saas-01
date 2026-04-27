import IORedis from 'ioredis'

let _conn: IORedis | null = null

export function getRedisConnection(): IORedis | null {
  if (!process.env.REDIS_URL) return null
  if (!_conn) {
    _conn = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null })
  }
  return _conn
}

export const hasRedis = (): boolean => Boolean(process.env.REDIS_URL)
