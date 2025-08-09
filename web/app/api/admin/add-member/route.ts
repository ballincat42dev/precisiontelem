import { NextRequest, NextResponse } from 'next/server'
import { createServerUserClient } from '@/lib/supabaseClient'

export async function POST(req: NextRequest) {
  const supa = createServerUserClient()
  const { data: { user } } = await supa.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await req.json()
  const teamId = body?.teamId
  const emailOrId = (body?.emailOrId || '').toString().trim()
  if (!teamId || !emailOrId) return NextResponse.json({ error: 'teamId and emailOrId required' }, { status: 400 })

  // Verify current user is owner/admin on the team
  const { data: me } = await supa.from('team_member')
    .select('role').eq('team_id', teamId).eq('user_id', user.id).maybeSingle()
  if (!me || (me.role !== 'owner' && me.role !== 'admin'))
    return NextResponse.json({ error: 'Forbidden: owner/admin only' }, { status: 403 })

  // Resolve user by email or id
  let targetId: string | null = null
  if (emailOrId.includes('@')) {
    const { data: row } = await supa.from('app_user').select('id').eq('email', emailOrId).maybeSingle()
    if (!row) return NextResponse.json({ error: 'No user found for that email (ask them to sign in once first)' }, { status: 404 })
    targetId = row.id
  } else {
    targetId = emailOrId
  }

  const ins = await supa.from('team_member').insert({ team_id: teamId, user_id: targetId, role: 'member' })
  if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
