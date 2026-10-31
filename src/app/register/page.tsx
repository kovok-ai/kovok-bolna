'use client';

import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';

export default function RegisterPage() {
  const [workspaceName, setWorkspaceName] = useState('');
  const [businessType, setBusinessType] = useState('Contractor / Builder');
  const [serviceArea, setServiceArea] = useState('Delhi NCR · 2 sites');
  const [adminName, setAdminName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceName: workspaceName.trim(),
          businessType,
          serviceArea: serviceArea.trim(),
          adminName: adminName.trim(),
          email: email.trim(),
          password,
          phone: phone.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Provisioning failed. Please verify inputs.');
        setLoading(false);
        return;
      }

      // Full navigation guarantees document session cookie is active on home page load
      window.location.href = '/';
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
        padding: '30px 20px',
      }}
    >
      <div
        className="panel"
        style={{
          width: '100%',
          maxWidth: '520px',
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
            <div className="brand-sub">WORKSPACE PROVISIONING</div>
          </div>
        </div>

        <h1 style={{ fontSize: '18px', fontWeight: 650, margin: '0 0 6px', letterSpacing: '-0.3px' }}>
          Provision new procurement workspace
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '12px', margin: '0 0 20px', lineHeight: 1.45 }}>
          Create an isolated enterprise workspace with dedicated sites, policy rules, and role permissions.
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
            <label htmlFor="workspaceName">Company / Business Name *</label>
            <input
              id="workspaceName"
              required
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              placeholder="e.g. Concrete & Co. Infrastructure Ltd."
            />
          </div>

          <div className="form-grid">
            <div className="field">
              <label htmlFor="businessType">Business Type</label>
              <select
                id="businessType"
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
              >
                <option>Contractor / Builder</option>
                <option>Material Dealer / Distributor</option>
                <option>Subcontractor</option>
                <option>Project Procurement Team</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="serviceArea">Primary Delivery Area</label>
              <input
                id="serviceArea"
                required
                value={serviceArea}
                onChange={(e) => setServiceArea(e.target.value)}
                placeholder="e.g. Delhi NCR · 2 sites"
              />
            </div>
          </div>

          <div className="divider" style={{ margin: '8px 0' }} />

          <div className="form-grid">
            <div className="field">
              <label htmlFor="adminName">Administrator Name *</label>
              <input
                id="adminName"
                required
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder="e.g. Shiwang Gupta"
              />
            </div>

            <div className="field">
              <label htmlFor="phone">Contact Phone</label>
              <input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="email">Administrator Email *</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. admin@concreteandco.in"
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password (min 8 characters) *</label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            {loading ? 'Provisioning...' : (
              <>
                Complete Workspace Setup <ArrowRight size={14} />
              </>
            )}
          </button>
        </form>

        <div className="divider" style={{ margin: '20px 0 16px' }} />

        <div style={{ fontSize: '11px', color: 'var(--muted)', textAlign: 'center' }}>
          Already have an authorized workspace?{' '}
          <a
            href="/login"
            style={{ color: 'var(--blue)', fontWeight: 600, textDecoration: 'none' }}
          >
            Sign in
          </a>
        </div>
      </div>
    </div>
  );
}
