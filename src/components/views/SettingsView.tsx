'use client';

import React, { useState } from 'react';

interface SettingsViewProps {
  onSave?: (settings: any) => void;
}

export function SettingsView({ onSave }: SettingsViewProps) {
  const [approver, setApprover] = useState('Workspace owner or assigned project manager');
  const [threshold, setThreshold] = useState('₹50,000 and above');
  const [maxVendors, setMaxVendors] = useState('3');
  const [substitutions, setSubstitutions] = useState('Never substitute without explicit approval');
  const [callWindow, setCallWindow] = useState('Weekdays · 10:00 AM–6:00 PM');
  const [language, setLanguage] = useState('Hindi + English (code-switch where appropriate)');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    if (onSave) {
      onSave({ approver, threshold, maxVendors, substitutions, callWindow, language });
    }
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Settings & rules</h1>
          <p>Approval policy, supplier calls and material rules</p>
        </div>
        <div className="head-actions">
          <button className="btn btn-primary" onClick={handleSave}>
            {saved ? 'Saved ✓' : 'Save'}
          </button>
        </div>
      </div>

      <div className="grid two-col">
        {/* Buying Policy */}
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Buying policy</h2>
              <p>Rules the agent must follow every time</p>
            </div>
          </div>
          <div className="panel-body">
            <div className="field" style={{ marginBottom: '14px' }}>
              <label>Who can approve purchases?</label>
              <select
                value={approver}
                onChange={(e) => setApprover(e.target.value)}
                aria-label="Approver role"
              >
                <option>Workspace owner or assigned project manager</option>
                <option>Department approver</option>
                <option>Site manager</option>
              </select>
            </div>

            <div className="form-grid">
              <div className="field">
                <label>Competitive sourcing threshold</label>
                <select
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  aria-label="Competitive sourcing threshold"
                >
                  <option>₹50,000 and above</option>
                  <option>₹25,000 and above</option>
                  <option>Always ask me</option>
                </select>
              </div>
              <div className="field">
                <label>Maximum vendors per RFQ</label>
                <select
                  value={maxVendors}
                  onChange={(e) => setMaxVendors(e.target.value)}
                  aria-label="Maximum vendors per RFQ"
                >
                  <option>3</option>
                  <option>2</option>
                  <option>5</option>
                </select>
              </div>
            </div>

            <div className="field" style={{ marginTop: '14px' }}>
              <label>Material substitution policy</label>
              <select
                value={substitutions}
                onChange={(e) => setSubstitutions(e.target.value)}
                aria-label="Material substitution policy"
              >
                <option>Never substitute without explicit approval</option>
                <option>Only listed equivalent items, with approval</option>
              </select>
            </div>

            <div className="field" style={{ marginTop: '14px' }}>
              <label>Call window (IST)</label>
              <select
                value={callWindow}
                onChange={(e) => setCallWindow(e.target.value)}
                aria-label="Call window"
              >
                <option>Weekdays · 10:00 AM–6:00 PM</option>
                <option>Weekdays · 9:00 AM–5:00 PM</option>
              </select>
            </div>

            <div className="field" style={{ marginTop: '14px' }}>
              <label>Default voice language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                aria-label="Voice language"
              >
                <option>Hindi + English (code-switch where appropriate)</option>
                <option>Hindi</option>
                <option>English</option>
                <option>Ask per supplier</option>
              </select>
            </div>
          </div>
        </section>

        {/* Recovery Permissions */}
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Recovery permissions</h2>
              <p>What Kovok can do without asking again</p>
            </div>
          </div>
          <div className="panel-body">
            <label className="checkline">
              <input type="checkbox" defaultChecked /> Retry unanswered supplier calls within configured limits.
            </label>
            <label className="checkline">
              <input type="checkbox" defaultChecked /> Ask a supplier to clarify missing freight, tax or ETA terms.
            </label>
            <label className="checkline">
              <input type="checkbox" /> Contact alternative suppliers when the original supplier is short.
            </label>
            <label className="checkline">
              <input type="checkbox" /> Approve a price change or specification substitution automatically (not recommended).
            </label>
            <label className="checkline">
              <input type="checkbox" defaultChecked /> Escalate unresolved safety, specification or commercial conflicts.
            </label>
            <div className="alert" style={{ marginTop: '14px' }}>
              Kovok may investigate and prepare options. It must not place an order or change an approved material/price without the required authority.
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
