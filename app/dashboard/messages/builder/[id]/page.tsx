import { notFound } from 'next/navigation'
import { getAuthContext } from '@/lib/auth'
import { getSupabaseServerClient } from '@/lib/supabase'
import FlowBuilder from '../FlowBuilder'

type Params = { params: Promise<{ id: string }> }

export default async function EditFlowPage({ params }: Params) {
  const { id } = await params

  const ctx = await getAuthContext()
  if (!ctx) notFound()

  const db = getSupabaseServerClient()

  const { data: auto } = await db
    .from('automations')
    .select('id, name, description, trigger_type')
    .eq('id', id)
    .eq('company_id', ctx.company.id)
    .single()

  if (!auto) notFound()

  const { data: steps } = await db
    .from('automation_steps')
    .select('id, step_order, subject, body_html, delay_days')
    .eq('automation_id', id)
    .order('step_order')

  const initialData = {
    id:           auto.id as string,
    name:         auto.name as string,
    description:  (auto.description ?? '') as string,
    trigger_type: (auto.trigger_type as 'manual' | 'new_client' | 'client_overdue') ?? 'manual',
    steps: (steps ?? []).map((s) => ({
      id:         s.id as string,
      step_order: s.step_order as number,
      delay_days: s.delay_days as number,
      subject:    s.subject as string,
      body_html:  s.body_html as string,
    })),
  }

  return <FlowBuilder initialData={initialData} />
}
