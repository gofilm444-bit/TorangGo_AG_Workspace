import React from 'react';

export default function AdminHomePage() {
  return (
    <main style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      color: '#0f172a',
      textAlign: 'center',
      padding: '2rem'
    }}>
      <h1 style={{ fontSize: '2.5rem', margin: '0 0 1rem 0' }}>TorangGo Admin</h1>
      <p style={{ fontSize: '1.25rem', color: '#475569', margin: 0 }}>Foundation Ready</p>
    </main>
  );
}
