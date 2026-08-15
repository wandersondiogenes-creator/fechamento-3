import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'Wanfinance Pro — Gestão & Conciliação Financeira',
  description: 'Arquitetura Apple para conciliação financeira, extratos SiTef, Dealer e auditoria Supabase.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
