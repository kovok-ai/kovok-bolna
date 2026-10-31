'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Check,
  Plus,
  Building2,
  MapPin,
  RefreshCw,
  X,
  ShieldCheck,
  Clock,
  PhoneCall,
} from 'lucide-react';

interface SettingsViewProps {
  onSave?: (settings: any) => void;
}

export function SettingsView({ onSave }: SettingsViewProps) {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Form fields
  const [threshold, setThreshold] = useState('50000');
  const [maxVendors, setMaxVendors] = useState(3);
  const [substitutions, setSubstitutions] = useState(false);
  const [callWindowStart, setCallWindowStart] = useState('10:00');
  const [callWindowEnd, setCallWindowEnd] = useState('18:00');
  const [callLanguage, setCallLanguage] = useState('hi-IN');
  const [maxRetries, setMaxRetries] = useState(2);
  const [autoRetry, setAutoRetry] = useState(true);
  const [autoClarify, setAutoClarify] = useState(true);

  // Projects & Sites Management
  const [sites, setSites] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [isSiteModalOpen, setIsSiteModalOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);

  // New site form
  const [newSiteName, setNewSiteName] = useState('');
  const [newSitePin, setNewSitePin] = useState('');
  const [newSiteCity, setNewSiteCity] = useState('');
  const [newSiteAddress, setNewSiteAddress] = useState('');
  const [newSiteContact, setNewSiteContact] = useState('');
  const [newSitePhone, setNewSitePhone] = useState('');
  const [newSiteGate, setNewSiteGate] = useState('');
  const [newSiteIsDefault, setNewSiteIsDefault] = useState(false);
  const [newSiteProjectId, setNewSiteProjectId] = useState('');

  // New project form
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectCode, setNewProjectCode] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = () => {
    setLoading(true);
    Promise.all([
      fetch('/api/settings').then((r) => r.json()),
      fetch('/api/sites').then((r) => r.json()),
      fetch('/api/projects').then((r) => r.json()),
    ])
      .then(([settingsData, sitesData, projectsData]) => {
        if (settingsData?.profile) {
          const p = settingsData.profile;
          setProfile(p);
          setThreshold(String(p.competitiveThreshold || '50000'));
          setMaxVendors(p.maxVendorsPerRfq || 3);
          setSubstitutions(p.allowSubstitutions || false);
          setCallWindowStart(p.callWindowStart || '10:00');
          setCallWindowEnd(p.callWindowEnd || '18:00');
          setCallLanguage(p.callLanguage || 'hi-IN');
          setMaxRetries(p.maxRetries || 2);
          setAutoRetry(p.autoRetryUnanswered !== false);
          setAutoClarify(p.autoClarifyMissing !== false);
        }
        if (sitesData?.sites) setSites(sitesData.sites);
        if (projectsData?.projects) setProjects(projectsData.projects);
      })
      .catch((err) => {
        console.error('Failed to load settings:', err);
        showToast('Error loading workspace rules');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          competitiveThreshold: parseFloat(threshold) || 50000,
          maxVendorsPerRfq: maxVendors,
          allowSubstitutions: substitutions,
          callWindowStart,
          callWindowEnd,
          callLanguage,
          maxRetries,
          autoRetryUnanswered: autoRetry,
          autoClarifyMissing: autoClarify,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update settings');

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      showToast('Procurement policy and telephony calling rules updated.');
      if (onSave) onSave(data.profile);
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim() || !newProjectCode.trim()) {
      showToast('Project name and code are required.');
      return;
    }

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProjectName.trim(),
          code: newProjectCode.trim(),
          description: newProjectDesc.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create project');

      showToast(`Project ${data.project.name} created.`);
      setIsProjectModalOpen(false);
      setNewProjectName('');
      setNewProjectCode('');
      setNewProjectDesc('');
      loadData();
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    }
  };

  const handleCreateSite = async () => {
    if (!newSiteName.trim() || !newSitePin.trim() || !newSiteCity.trim() || !newSiteAddress.trim()) {
      showToast('Site name, PIN code, city, and address are required.');
      return;
    }

    try {
      const res = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteName: newSiteName.trim(),
          pinCode: newSitePin.trim(),
          city: newSiteCity.trim(),
          address: newSiteAddress.trim(),
          contactName: newSiteContact.trim() || undefined,
          contactPhone: newSitePhone.trim() || undefined,
          gateTimings: newSiteGate.trim() || undefined,
          isDefault: newSiteIsDefault,
          projectId: newSiteProjectId || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create site');

      showToast(`Delivery site ${data.site.siteName} added.`);
      setIsSiteModalOpen(false);
      setNewSiteName('');
      setNewSitePin('');
      setNewSiteCity('');
      setNewSiteAddress('');
      setNewSiteContact('');
      setNewSitePhone('');
      setNewSiteGate('');
      setNewSiteIsDefault(false);
      loadData();
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    }
  };

  const handleToggleDefaultSite = async (siteId: string) => {
    try {
      const res = await fetch(`/api/sites/${siteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      });
      if (!res.ok) throw new Error('Failed to set default site');
      showToast('Default delivery site updated.');
      loadData();
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    }
  };

  const handleToggleActiveSite = async (siteId: string, currentActive: boolean) => {
    try {
      const res = await fetch(`/api/sites/${siteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentActive }),
      });
      if (!res.ok) throw new Error('Failed to update site status');
      showToast(`Site ${!currentActive ? 'activated' : 'archived'}.`);
      loadData();
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    }
  };

  return (
    <div>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="toast" style={{ top: '24px', zIndex: 1100 }}>
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <div className="page-head">
        <div>
          <h1>Settings &amp; Procurement Rules</h1>
          <p>Buying policy, telephony calling windows, and project delivery sites</p>
        </div>
        <div className="head-actions">
          <button className="btn btn-secondary" onClick={loadData} title="Refresh settings">
            <RefreshCw size={13} style={{ marginRight: '6px' }} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saved ? (
              <>
                <Check size={14} style={{ marginRight: '4px' }} /> Saved
              </>
            ) : saving ? (
              'Saving...'
            ) : (
              'Save Settings'
            )}
          </button>
        </div>
      </div>

      <div className="grid two-col" style={{ gap: '20px' }}>
        {/* Buying Policy & Invariants */}
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Buying Policy &amp; Approval Thresholds</h2>
              <p>Rules the agent and buyers must follow for all requisitions</p>
            </div>
          </div>
          <div className="panel-body">
            <div className="field" style={{ marginBottom: '14px' }}>
              <label>Competitive Sourcing Threshold (₹)</label>
              <input
                type="number"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                placeholder="50000"
              />
              <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                Requisitions above this value require at least 2 comparable supplier quotations before approval.
              </span>
            </div>

            <div className="form-grid" style={{ marginBottom: '14px' }}>
              <div className="field">
                <label>Max Vendors per RFQ</label>
                <select
                  value={maxVendors}
                  onChange={(e) => setMaxVendors(parseInt(e.target.value, 10))}
                  aria-label="Max Vendors per RFQ"
                >
                  <option value={2}>2 Vendors</option>
                  <option value={3}>3 Vendors</option>
                  <option value={5}>5 Vendors</option>
                </select>
              </div>
              <div className="field">
                <label>Material Substitution Policy</label>
                <select
                  value={substitutions ? 'allowed' : 'strict'}
                  onChange={(e) => setSubstitutions(e.target.value === 'allowed')}
                  aria-label="Material Substitution Policy"
                >
                  <option value="strict">Never substitute without explicit approval</option>
                  <option value="allowed">Allow listed BIS equivalents with approval</option>
                </select>
              </div>
            </div>

            <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11.5px', color: '#475569' }}>
              <strong>Core Domain Invariant:</strong> Kovok never places purchase orders automatically. Direct buyer authorization is required for every commercial commitment.
            </div>
          </div>
        </section>

        {/* Telephony & Calling Windows */}
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Sarvam Voice Telephony Rules</h2>
              <p>Outbound dialing windows conforming to TRAI commercial guidelines</p>
            </div>
          </div>
          <div className="panel-body">
            <div className="form-grid" style={{ marginBottom: '14px' }}>
              <div className="field">
                <label>Calling Window Start (IST)</label>
                <input
                  type="time"
                  value={callWindowStart}
                  onChange={(e) => setCallWindowStart(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Calling Window End (IST)</label>
                <input
                  type="time"
                  value={callWindowEnd}
                  onChange={(e) => setCallWindowEnd(e.target.value)}
                />
              </div>
            </div>

            <div className="form-grid" style={{ marginBottom: '14px' }}>
              <div className="field">
                <label>Agent Language &amp; Dialect</label>
                <select
                  value={callLanguage}
                  onChange={(e) => setCallLanguage(e.target.value)}
                  aria-label="Agent Language & Dialect"
                >
                  <option value="hi-IN">Hindi + English (Natural Code-Switch)</option>
                  <option value="en-IN">Indian English Professional</option>
                </select>
              </div>
              <div className="field">
                <label>Max Retries for Unanswered Calls</label>
                <select
                  value={maxRetries}
                  onChange={(e) => setMaxRetries(parseInt(e.target.value, 10))}
                  aria-label="Max Retries for Unanswered Calls"
                >
                  <option value={1}>1 Retry</option>
                  <option value={2}>2 Retries</option>
                  <option value={3}>3 Retries</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={autoRetry}
                  onChange={(e) => setAutoRetry(e.target.checked)}
                />
                Auto-retry busy or unanswered supplier calls within window
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={autoClarify}
                  onChange={(e) => setAutoClarify(e.target.checked)}
                />
                Automatically queue callback if freight terms are unquoted
              </label>
            </div>
          </div>
        </section>

        {/* Projects Management */}
        <section className="panel" style={{ gridColumn: '1 / -1' }}>
          <div className="panel-head">
            <div>
              <h2>Projects &amp; Delivery Sites</h2>
              <p>Manage buyer projects and verified unloading destination coordinates</p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-secondary" onClick={() => setIsProjectModalOpen(true)}>
                <Plus size={13} style={{ marginRight: '4px' }} /> New Project
              </button>
              <button className="btn btn-primary" onClick={() => setIsSiteModalOpen(true)}>
                <Plus size={13} style={{ marginRight: '4px' }} /> Add Delivery Site
              </button>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Site Name</th>
                  <th>Project</th>
                  <th>PIN &amp; City</th>
                  <th>Delivery Address</th>
                  <th>Contact Details</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sites.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <strong>{s.siteName}</strong>
                        {s.isDefault && (
                          <span className="pill green" style={{ fontSize: '9px', padding: '1px 6px' }}>
                            Default
                          </span>
                        )}
                      </div>
                      <span className="sub">Gate: {s.gateTimings || 'Standard hours'}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: '12px', color: '#1e40af', fontWeight: 600 }}>
                        {s.project?.name || 'General Project'}
                      </span>
                    </td>
                    <td>
                      <strong>{s.pinCode}</strong>
                      <span className="sub">{s.city}</span>
                    </td>
                    <td style={{ maxWidth: '280px' }}>
                      <span style={{ fontSize: '12px', color: '#334155' }}>{s.address}</span>
                    </td>
                    <td>
                      <div>{s.contactName || 'Site Engineer'}</div>
                      <span className="sub">{s.contactPhone || 'On file'}</span>
                    </td>
                    <td>
                      <span className={`pill ${s.isActive ? 'green' : 'gray'}`} style={{ fontSize: '10px' }}>
                        {s.isActive ? 'Active' : 'Archived'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {!s.isDefault && (
                          <button
                            className="row-action"
                            onClick={() => handleToggleDefaultSite(s.id)}
                            title="Set as workspace default"
                          >
                            Set Default
                          </button>
                        )}
                        <button
                          className="row-action"
                          style={{ color: s.isActive ? '#b91c1c' : '#15803d' }}
                          onClick={() => handleToggleActiveSite(s.id, s.isActive)}
                        >
                          {s.isActive ? 'Archive' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Add Project Modal */}
      {isProjectModalOpen && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setIsProjectModalOpen(false)}>
          <div className="modal" style={{ maxWidth: '480px' }}>
            <div className="modal-head">
              <div>
                <div className="eyebrow">WORKSPACE PROJECT</div>
                <h2>Create Construction Project</h2>
                <p>Group delivery sites and purchase orders by project</p>
              </div>
              <button className="icon-btn" onClick={() => setIsProjectModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="wizard-main">
              <div className="field" style={{ marginBottom: '14px' }}>
                <label>Project Name</label>
                <input
                  placeholder="e.g. DLF Cybercity Phase III"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                />
              </div>

              <div className="field" style={{ marginBottom: '14px' }}>
                <label>Project Code</label>
                <input
                  placeholder="e.g. DLF-CC3"
                  value={newProjectCode}
                  onChange={(e) => setNewProjectCode(e.target.value)}
                />
              </div>

              <div className="field" style={{ marginBottom: '14px' }}>
                <label>Description (Optional)</label>
                <textarea
                  placeholder="Commercial towers, foundation raft and superstructure..."
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  rows={2}
                />
              </div>
            </div>

            <div className="wizard-footer">
              <button className="btn btn-secondary" onClick={() => setIsProjectModalOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleCreateProject}>
                Create Project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Site Modal */}
      {isSiteModalOpen && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setIsSiteModalOpen(false)}>
          <div className="modal" style={{ maxWidth: '540px' }}>
            <div className="modal-head">
              <div>
                <div className="eyebrow">DELIVERY COORDINATES</div>
                <h2>Add Delivery Site</h2>
                <p>Register a verified unloading address for procurement delivery</p>
              </div>
              <button className="icon-btn" onClick={() => setIsSiteModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="wizard-main">
              <div className="form-grid" style={{ marginBottom: '14px' }}>
                <div className="field">
                  <label>Site Name</label>
                  <input
                    placeholder="e.g. Sector 62 Staging Yard"
                    value={newSiteName}
                    onChange={(e) => setNewSiteName(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Assign to Project (Optional)</label>
                  <select
                    value={newSiteProjectId}
                    onChange={(e) => setNewSiteProjectId(e.target.value)}
                    aria-label="Assign to Project"
                  >
                    <option value="">No Project Assigned</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-grid" style={{ marginBottom: '14px' }}>
                <div className="field">
                  <label>Postal PIN Code</label>
                  <input
                    placeholder="6-digit PIN e.g. 122002"
                    value={newSitePin}
                    onChange={(e) => setNewSitePin(e.target.value)}
                    maxLength={6}
                  />
                </div>
                <div className="field">
                  <label>City</label>
                  <input
                    placeholder="e.g. Gurugram"
                    value={newSiteCity}
                    onChange={(e) => setNewSiteCity(e.target.value)}
                  />
                </div>
              </div>

              <div className="field" style={{ marginBottom: '14px' }}>
                <label>Exact Delivery Address</label>
                <textarea
                  placeholder="Plot number, industrial area, landmark..."
                  value={newSiteAddress}
                  onChange={(e) => setNewSiteAddress(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="form-grid" style={{ marginBottom: '14px' }}>
                <div className="field">
                  <label>Site Contact Person</label>
                  <input
                    placeholder="e.g. Rajesh Kumar (Site Eng)"
                    value={newSiteContact}
                    onChange={(e) => setNewSiteContact(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Contact Mobile</label>
                  <input
                    placeholder="e.g. +919876543210"
                    value={newSitePhone}
                    onChange={(e) => setNewSitePhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="field" style={{ marginBottom: '14px' }}>
                <label>Gate Timings &amp; Access Notes</label>
                <input
                  placeholder="e.g. 08:00 AM - 07:00 PM; heavy vehicle entry permitted"
                  value={newSiteGate}
                  onChange={(e) => setNewSiteGate(e.target.value)}
                />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={newSiteIsDefault}
                  onChange={(e) => setNewSiteIsDefault(e.target.checked)}
                />
                Set as default delivery site for new procurement requisitions
              </label>
            </div>

            <div className="wizard-footer">
              <button className="btn btn-secondary" onClick={() => setIsSiteModalOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleCreateSite}>
                Save Delivery Site
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
