import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase'
import dns from 'dns/promises'

async function getCompanyId(db: ReturnType<typeof getSupabaseServerClient>): Promise<string | null> {
  const { data: { user } } = await db.auth.getUser()
  if (!user) return null
  const { data: u } = await db.from('users').select('id').eq('auth_id', user.id).single()
  if (!u) return null
  const { data: c } = await db.from('companies').select('id').eq('user_id', u.id).single()
  return c?.id ?? null
}

export async function POST(req: NextRequest) {
  const db = getSupabaseServerClient()
  const companyId = await getCompanyId(db)
  if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { domain } = await req.json() as { domain?: string }
  if (!domain) return NextResponse.json({ error: 'domain required' }, { status: 400 })

  const [spfRecords, dkimRecords, dmarcRecords] = await Promise.allSettled([
    dns.resolveTxt(domain),
    dns.resolveTxt(`default._domainkey.${domain}`),
    dns.resolveTxt(`_dmarc.${domain}`),
  ])

  const flatTxt = (r: PromiseSettledResult<string[][]>) =>
    r.status === 'fulfilled' ? r.value.flat().join(' ') : ''

  const spfStr   = flatTxt(spfRecords)
  const dkimStr  = flatTxt(dkimRecords)
  const dmarcStr = flatTxt(dmarcRecords)

  const spfVerified   = spfStr.includes('v=spf1')
  const dkimVerified  = dkimStr.includes('v=DKIM1')
  const dmarcVerified = dmarcStr.includes('v=DMARC1')
  const domainVerified = spfVerified && dkimVerified && dmarcVerified

  await db.from('business_identity').update({
    domain_verified:     domainVerified,
    domain_verified_at:  domainVerified ? new Date().toISOString() : null,
    spf_verified:        spfVerified,
    dkim_verified:       dkimVerified,
    dmarc_verified:      dmarcVerified,
  }).eq('company_id', companyId)

  return NextResponse.json({ domainVerified, spfVerified, dkimVerified, dmarcVerified })
}
