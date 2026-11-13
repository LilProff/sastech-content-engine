'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clearAuthToken } from '@/lib/supabaseClient';

const NAV_ITEMS = [
  { href: '/assistant', label: 'Assistant' },
  { href: '/profile', label: 'Profile' },
  { href: '/documents', label: 'Documents' },
  { href: '/cv', label: 'CV' },
  { href: '/opportunities', label: 'Opportunities' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-dvh bg-background">
      <aside className="flex w-56 flex-shrink-0 flex-col border-r border-border px-4 py-6">
        <div className="mb-8 flex items-center gap-2.5 px-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-semibold text-accent-foreground">
            C
          </div>
          <span className="text-sm font-semibold tracking-tight text-foreground">Career OS</span>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-surface-elevated text-foreground'
                    : 'text-muted hover:bg-surface hover:text-foreground'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={() => {
            clearAuthToken();
            window.location.reload();
          }}
          className="rounded-lg px-3 py-2 text-left text-sm font-medium text-muted transition-colors hover:bg-surface hover:text-foreground"
        >
          Sign out
        </button>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
