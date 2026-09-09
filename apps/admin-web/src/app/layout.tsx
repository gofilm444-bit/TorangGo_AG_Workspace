import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'TorangGo Admin',
  description: 'TorangGo Admin Web Portal',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
