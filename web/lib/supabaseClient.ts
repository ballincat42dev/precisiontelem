import { createBrowserClient, createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export function createClientComponentClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createBrowserClient(supabaseUrl, supabaseKey);
}

export function createServerUserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const cookieStore = cookies();
  return createServerClient(supabaseUrl, anonKey, { cookies: () => cookieStore });
}

export function createServerAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE!;
  const cookieStore = cookies();
  return createServerClient(supabaseUrl, serviceRoleKey, { cookies: () => cookieStore });
}
