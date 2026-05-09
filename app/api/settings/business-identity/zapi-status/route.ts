import { NextRequest, NextResponse } from 'next/server'
import { zapiGetStatus } from '@/lib/zapi'

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    instanceId?:  string
    token?:       string
    clientToken?: string
  }

  if (!body.instanceId || !body.token) {
    return NextResponse.json({ connected: false, error: 'instanceId and token required' }, { status: 400 })
  }

  const result = await zapiGetStatus({
    instanceId:  body.instanceId,
    token:       body.token,
    clientToken: body.clientToken,
  })

  return NextResponse.json(result)
}
