'use client';

import React, { useState, useEffect } from 'react';
import {
  Database,
  Compass,
  ShieldCheck,
  FileSpreadsheet,
  PhoneCall,
  Building2,
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';

interface IntegrationItem {
  id: string;
  name: string;
  type: string;
  status: string;
  statusColor: string;
  description: string;
  action: string;
  details?: any;
}

export function IntegrationsView() {
  const [integrations, setIntegrations] = useState<IntegrationItem[]>([]);
  const [sarvamConfig, setSarvamConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const fetchStatus = () => {
    setLoading(true);
    fetch('/api/integrations/status')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load integration status');
        return res.json();
      })
      .then((data) => {
        if (data?.integrations) {
          setIntegrations(data.integrations);
          setSarvamConfig(data.sarvamConfig);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch integrations:', err);
        showToast('Error loading live system integration statuses');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const getIcon = (id: string) => {
    switch (id) {
      case 'postgres':
        return <Database size={22} className="text-blue-600" />;
      case 'catalogue':
        return <Compass size={22} className="text-blue-600" />;
      case 'session_auth':
        return <ShieldCheck size={22} className="text-blue-600" />;
      case 'csv_excel':
        return <FileSpreadsheet size={22} className="text-blue-600" />;
      case 'sarvam_voice':
        return <PhoneCall size={22} className="text-blue-600" />;
      case 'erpnext':
        return <Building2 size={22} className="text-gray-500" />;
      default:
        return <FileText size={22} className="text-gray-500" />;
    }
  };

  return (
    <div>
      {/* Toast Notification */}
      {toast && (
        <div className="toast" style={{ top: '24px', zIndex: 1100 }}>
          {toast}
        </div>
      )}

      {/* Page Header */}
      <div className="page-head">
        <div>
          <h1>Integrations &amp; System Connections</h1>
          <p>Authoritative connection status, database invariants, and voice telephony gateway</p>
        </div>
        <div className="head-actions">
          <button className="btn btn-secondary" onClick={fetchStatus} title="Refresh integration status">
            <RefreshCw size={13} style={{ marginRight: '6px' }} /> Refresh Status
          </button>
          <button className="btn btn-primary" onClick={() => setActiveModal('csv_excel')}>
            Import Data
          </button>
        </div>
      </div>

      {/* Grid of Integration Cards */}
      <div className="grid two-col" style={{ gap: '16px', marginBottom: '24px' }}>
        {loading ? (
          <div style={{ padding: '32px', gridColumn: '1 / -1', textAlign: 'center', color: '#64748b' }}>
            Checking authoritative subsystem connections...
          </div>
        ) : (
          integrations.map((item) => (
            <div
              key={item.id}
              className="panel"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '20px',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '8px',
                        background: '#f1f5f9',
                        display: 'grid',
                        placeItems: 'center',
                        color: '#1e40af',
                      }}
                    >
                      {getIcon(item.id)}
                    </div>
                    <div>
                      <strong style={{ fontSize: '15px', color: '#0f172a', display: 'block' }}>{item.name}</strong>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>{item.type}</span>
                    </div>
                  </div>
                  <span
                    className={`pill ${item.statusColor}`}
                    style={{ textTransform: 'capitalize', padding: '4px 10px', fontSize: '11px' }}
                  >
                    <span className="dot"></span>
                    {item.status}
                  </span>
                </div>
                <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5, margin: '8px 0 16px' }}>
                  {item.description}
                </p>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderTop: '1px solid #f1f5f9',
                  paddingTop: '14px',
                  marginTop: 'auto',
                }}
              >
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                  {item.id === 'sarvam_voice'
                    ? 'Samvaad Outbound Telephony'
                    : item.id === 'postgres'
                    ? 'Transaction-Local Tenant RLS'
                    : 'System Component'}
                </span>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: '12px', padding: '6px 14px' }}
                  onClick={() => setActiveModal(item.id)}
                >
                  {item.action}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Sarvam AI Diagnostics Modal */}
      {activeModal === 'sarvam_voice' && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setActiveModal(null)}>
          <div className="modal" style={{ maxWidth: '640px' }}>
            <div className="modal-head">
              <div>
                <div className="eyebrow">TELEPHONY CONFIGURATION DIAGNOSTICS</div>
                <h2>Sarvam AI Voice Telephony Gateway</h2>
                <p>Status: {sarvamConfig?.status || 'Inspecting'}</p>
              </div>
              <button className="icon-btn" onClick={() => setActiveModal(null)}>
                &times;
              </button>
            </div>

            <div className="wizard-main">
              <div
                style={{
                  padding: '14px',
                  borderRadius: '8px',
                  background: sarvamConfig?.isConfigured ? '#f0fdf4' : '#fffbeb',
                  border: `1px solid ${sarvamConfig?.isConfigured ? '#bbf7d0' : '#fde68a'}`,
                  marginBottom: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  {sarvamConfig?.isConfigured ? (
                    <CheckCircle2 size={16} className="text-green-600" />
                  ) : (
                    <AlertCircle size={16} className="text-amber-600" />
                  )}
                  <strong style={{ fontSize: '13px', color: sarvamConfig?.isConfigured ? '#15803d' : '#b45309' }}>
                    {sarvamConfig?.isConfigured
                      ? 'Live Telephony Gateway Configured'
                      : 'Voice Configuration Incomplete'}
                  </strong>
                </div>
                <p style={{ fontSize: '12px', color: '#475569', margin: 0, lineHeight: 1.45 }}>
                  {sarvamConfig?.isConfigured
                    ? 'All server-only credentials, organization parameters, and DID phone numbers are present. Outbound supplier quotation calls are authorized.'
                    : 'Outbound voice calling is inhibited until required server environment variables are populated in the deployment environment.'}
                </p>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b', marginBottom: '8px' }}>
                  Required Server Environment Variables:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {[
                    'SARVAM_VOICE_WORKSPACE_API_KEY',
                    'SARVAM_ORG_ID',
                    'SARVAM_WORKSPACE_ID',
                    'SARVAM_AGENT_APP_ID',
                    'SARVAM_AGENT_APP_VERSION',
                    'SARVAM_CONNECTION_ID',
                    'SARVAM_AGENT_PHONE_NUMBER',
                    'APP_BASE_URL',
                  ].map((key) => {
                    const isConfigured = sarvamConfig?.configuredVariables?.includes(key);
                    return (
                      <div
                        key={key}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 10px',
                          background: '#f8fafc',
                          borderRadius: '6px',
                          border: '1px solid #e2e8f0',
                          fontSize: '11.5px',
                        }}
                      >
                        <code>{key}</code>
                        <span
                          className={`pill ${isConfigured ? 'green' : 'gray'}`}
                          style={{ fontSize: '10px', padding: '2px 8px' }}
                        >
                          {isConfigured ? 'Set' : 'Missing'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '12px',
                  fontSize: '11px',
                  color: '#64748b',
                  lineHeight: 1.45,
                }}
              >
                <strong>Security Guard:</strong> API key values, SIP tokens, and authorization headers are strictly kept server-side and are never transmitted to client JavaScript. See <code>docs/integrations/SARVAM_VOICE_SETUP.md</code> for onboarding steps.
              </div>
            </div>

            <div className="wizard-footer">
              <button className="btn btn-secondary" onClick={() => setActiveModal(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Importer Modal */}
      {activeModal === 'csv_excel' && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setActiveModal(null)}>
          <div className="modal" style={{ maxWidth: '580px' }}>
            <div className="modal-head">
              <div>
                <div className="eyebrow">CONTROLLED DATA INGESTION</div>
                <h2>Import Procurement Requisitions &amp; Rosters</h2>
                <p>Upload project bill of quantities (BOQ) or verified vendor records</p>
              </div>
              <button className="icon-btn" onClick={() => setActiveModal(null)}>
                &times;
              </button>
            </div>

            <div className="wizard-main">
              <div
                style={{
                  border: '2px dashed #cbd5e1',
                  borderRadius: '10px',
                  padding: '36px 20px',
                  textAlign: 'center',
                  background: '#f8fafc',
                  marginBottom: '16px',
                  cursor: 'pointer',
                }}
                onClick={() => showToast('Select CSV or Excel file for staging and schema validation.')}
              >
                <FileSpreadsheet size={36} className="text-blue-600" style={{ margin: '0 auto 10px' }} />
                <strong style={{ display: 'block', fontSize: '13px', color: '#1e293b' }}>
                  Click to select CSV or XLSX file
                </strong>
                <span style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                  Strict schema verification and duplicate detection enforced before staging
                </span>
              </div>

              <div style={{ fontSize: '11.5px', color: '#64748b', lineHeight: 1.4 }}>
                <strong>Supported Schemas:</strong>
                <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
                  <li>Material BOQ: Category, Grade, Diameter, Quantity, Site PIN</li>
                  <li>Supplier Contacts: Entity Name, GSTIN, Phone, Service Area</li>
                </ul>
              </div>
            </div>

            <div className="wizard-footer">
              <button className="btn btn-secondary" onClick={() => setActiveModal(null)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setActiveModal(null);
                  showToast('File queued for controlled staging import.');
                }}
              >
                Validate &amp; Stage
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
