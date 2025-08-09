'use client';
import { useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function Login() {
  const supabase = createClientComponentClient();

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined } });
  };

  useEffect(()=>{
    // Ensure an app_user row exists for the current user
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('app_user').upsert({ id: user.id, email: user.email || null, display_name: user.user_metadata?.name || null });
      }
    })();
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <button className="btn" onClick={signInWithGoogle}>Continue with Google</button>
      <p className="text-sm text-neutral-500">You can manage providers in Supabase → Authentication → Providers.</p>
    </div>
  );
}
