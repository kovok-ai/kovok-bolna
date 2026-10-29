'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('shiwang@concreteandco.in');
  const [password, setPassword] = useState('KovokSecure2026!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Authentication failed. Please check credentials.');
        setLoading(false);
        return;
      }

      router.push('/');
      router.refresh();
    } catch {
      setError('Network error. Unable to connect to authentication server.');
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        display: 'grid',
        placeItems: 'center',
        padding: '20px',
      }}
    >
      <div
        className="panel"
        style={{
          width: '100%',
          maxWidth: '420px',
          padding: '28px 24px',
          boxShadow: '0 8px 30px rgba(23, 32, 45, 0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '20px' }}>
          <div className="mark">k.</div>
          <div>
            <div className="brand-name">
              kovok<span>.</span>
            </div>
            <div className="brand-sub">CONSTRUCTION PROCUREMENT</div>
          </div>
        </div>

        <h1 style={{ fontSize: '18px', fontWeight: 650, margin: '0 0 6px', letterSpacing: '-0.3px' }}>
          Sign in to your workspace
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '12px', margin: '0 0 20px', lineHeight: 1.45 }}>
          Authorized access to construction material procurement, supplier RFQs, and approvals.
        </p>

        {error && (
          <div
            className="alert"
            style={{
              background: '#fbf0f0',
              borderColor: '#f5c6cb',
              color: '#842029',
              marginBottom: '16px',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '14px' }}>
          <div className="field">
            <label htmlFor="email">Work Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. buyer@contractor.in"
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', marginTop: '6px' }}
          >
            {loading ? 'Authenticating...' : 'Sign In →'}
          </button>
        </form>

        <div className="divider" style={{ margin: '20px 0 16px' }} />

        <div style={{ fontSize: '11px', color: 'var(--muted)', textAlign: 'center' }}>
          Need to configure a new organization?{' '}
          <a
            href="/register"
            style={{ color: 'var(--blue)', fontWeight: 600, textDecoration: 'none' }}
          >
            Create workspace
          </a>
        </div>
      </div>
    </div>
  );
}
