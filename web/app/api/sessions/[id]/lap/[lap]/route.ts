import { NextRequest, NextResponse } from 'next/server'
import { createServerUserClient } from '@/lib/supabaseClient'

export async function GET(_req: NextRequest, { params }: { params: { id: string, lap: string } }) {
  const userClient = createServerUserClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  // Look up session to figure team id
  const { data: s, error } = await userClient.from('session').select('team_id').eq('id', params.id).single();
  if (error || !s) return NextResponse.json({ error: 'session not found' }, { status: 404 });

  // Ensure user is a member
  const { data: membership } = await userClient.from('team_member')
    .select('role').eq('team_id', s.team_id).eq('user_id', user.id).maybeSingle();
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Use service key for storage signed URL (server-only)
  // @ts-ignore
  const storage = (await import('@supabase/supabase-js')).createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!
  );
  const parsedBucket = process.env.SUPABASE_STORAGE_BUCKET_PARSED || 'telemetry-parsed';
  const path = `${s.team_id}/${params.id}/laps/${params.lap}.json`;

  const { data: signed, error: signErr } = await storage.storage.from(parsedBucket).createSignedUrl(path, 60);
  if (signErr || !signed) return NextResponse.json({ error: 'lap not ready' }, { status: 404 });

  const resp = await fetch(signed.signedUrl);
  if (!resp.ok) return NextResponse.json({ error: 'lap not found' }, { status: 404 });
  const rows = await resp.json();
  return NextResponse.json({ rows });
}
