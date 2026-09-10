import type { Metadata } from 'next';
import React from 'react';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'TorangGo Admin',
  description: 'TorangGo Operational Administration Web Portal',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
