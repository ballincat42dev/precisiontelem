export const metadata = { title: 'Precision — Telemetry', description: 'iRacing Telemetry Portal' };
import Link from 'next/link';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="container p-6 space-y-6">
          <header className="flex items-center justify-between">
            <nav className="flex items-center gap-4 text-sm">
              <Link className="underline" href="/">Home</Link>
              <Link className="underline" href="/sessions">Sessions</Link>
              <Link className="underline" href="/admin">Admin</Link>
              <Link className="underline" href="/login">Login</Link>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
