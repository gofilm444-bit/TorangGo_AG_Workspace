'use client';

import React, { useState, useCallback } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export interface AdminShellProps {
  children: React.ReactNode;
}

export function AdminShell({ children }: AdminShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
  }, []);

  const closeSidebar = useCallback(() => {
    setIsSidebarOpen(false);
  }, []);

  return (
    <div className="admin-shell">
      <a href="#main-content" className="skip-link">
        Lewati ke konten utama
      </a>

      <Sidebar isOpen={isSidebarOpen} onClose={closeSidebar} />

      <div className="admin-shell-main">
        <Header onToggleSidebar={toggleSidebar} isSidebarOpen={isSidebarOpen} />
        <main id="main-content" tabIndex={-1} className="admin-workspace" role="main">
          {children}
        </main>
      </div>
    </div>
  );
}
