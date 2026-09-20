import React from 'react';
import { AdminShell } from '../../components/shell';
import { requireServerAdminSession } from '../../lib/server-auth';
export const dynamic = 'force-dynamic';

export default async function AdminGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireServerAdminSession();
  return <AdminShell>{children}</AdminShell>;
}
