'use client';

import React, { type ReactNode } from 'react';
import { AdminAuthProvider } from '../lib/auth-context';

export function Providers({ children }: { children: ReactNode }) {
  return <AdminAuthProvider>{children}</AdminAuthProvider>;
}
