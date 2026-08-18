import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'CampusOS — operations platform for colleges and TVET institutions',
    template: '%s · CampusOS',
  },
  description:
    'CampusOS is a multi-tenant management platform for colleges and TVET institutions: admissions, academics, attendance, examinations and finance in one system.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
