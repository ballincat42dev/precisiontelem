import { NextRequest, NextResponse } from 'next/server'
import { createServerUserClient } from '@/lib/supabaseClient'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const base = (body?.base || '').toString().trim()
  if (!base) return NextResponse.json({ error: 'base required' }, { status: 400 })

  const supa = createServerUserClient()
  const { data: { user } } = await supa.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  // Create next label via RPC, then insert team and add current user as owner
  const labelRes = await supa.rpc('next_team_label', { base })
  if (labelRes.error) return NextResponse.json({ error: labelRes.error.message }, { status: 500 })

  const ins = await supa.from('team').insert({ name: labelRes.data }).select().single()
  if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 500 })

  const add = await supa.from('team_member').insert({ team_id: ins.data.id, user_id: user.id, role: 'owner' })
  if (add.error) return NextResponse.json({ error: add.error.message }, { status: 500 })

  return NextResponse.json({ team: ins.data })
}
