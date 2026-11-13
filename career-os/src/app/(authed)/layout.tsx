'use client';

import { useEffect, useState } from 'react';
import { getAuthToken } from '@/lib/supabaseClient';
import { LoginGate } from '@/components/LoginGate';
import { AppShell } from '@/components/AppShell';

export default function AuthedLayout({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'checking' | 'authed' | 'unauthed'>('checking');

  useEffect(() => {
    setStatus(getAuthToken() ? 'authed' : 'unauthed');
  }, []);

  if (status === 'checking') return null;
  if (status === 'unauthed') return <LoginGate onUnlocked={() => setStatus('authed')} />;

  return <AppShell>{children}</AppShell>;
}
