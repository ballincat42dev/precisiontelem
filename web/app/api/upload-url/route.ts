import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createServerUserClient, createServerAdminClient } from '@/lib/supabaseClient'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { filename, teamId } = body || {};
    if (!teamId) return NextResponse.json({ error: 'teamId required' }, { status: 400 });

    const userClient = createServerUserClient();
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    // Verify membership
    const { data: membership } = await userClient.from('team_member')
      .select('role').eq('team_id', teamId).eq('user_id', user.id).maybeSingle();
    if (!membership) return NextResponse.json({ error: 'Forbidden: not a team member' }, { status: 403 });

    // Create session row (insert via user client so RLS applies)
    const sessionId = randomUUID();
    const rawBucket = process.env.SUPABASE_STORAGE_BUCKET_RAW || 'telemetry-raw';
    const storagePath = `${teamId}/${sessionId}.ibt`;

    const insert = await userClient.from('session').insert({
      id: sessionId,
      team_id: teamId,
      uploader_id: user.id,
      storage_key: `${rawBucket}/${storagePath}`,
      status: 'uploaded'
    }).select().single();

    if (insert.error) return NextResponse.json({ error: insert.error.message }, { status: 500 });

    // Create signed upload URL with service role
    const admin = createServerAdminClient();
    // @ts-ignore
    const storage = (await import('@supabase/supabase-js')).createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!
    );
    const create = await storage.storage.from(rawBucket).createSignedUploadUrl(storagePath);
    if (create.error || !create.data) return NextResponse.json({ error: create.error?.message || 'Failed to create signed URL' }, { status: 500 });

    return NextResponse.json({ url: create.data.signedUrl, sessionId, storageKey: `${rawBucket}/${storagePath}` });
  } catch (e:any) {
    return NextResponse.json({ error: e.message || 'Unknown error' }, { status: 500 });
  }
}
