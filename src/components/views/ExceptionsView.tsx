'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Plus,
  X,
  FileText,
  ShieldAlert,
} from 'lucide-react';

interface ExceptionItem {
  id: string;
  exceptionCode: string;
  exceptionType: string;
  severity: string;
  status: string;
  title: string;
  description: string;
  relatedEntityType: string | null;
  relatedCode: string | null;
  resolutionAction: string | null;
  resolutionNotes: string | null;
  resolvedAt: string | null;
  createdAt: string;
  assignedUser?: { name: string } | null;
  resolvedByUser?: { name: string } | null;
}

interface ExceptionsViewProps {
  onReviewRecovery?: (code: string) => void;
}

export function ExceptionsView({ onReviewRecovery }: ExceptionsViewProps) {
  const [exceptions, setExceptions] = useState<ExceptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [selectedException, setSelectedException] = useState<ExceptionItem | null>(null);
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Resolve form
  const [resolutionAction, setResolutionAction] = useState('Alternative Vendor Sourcing');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [isResolving, setIsResolving] = useState(false);

  // Create form
  const [newType, setNewType] = useState('SHORT_SUPPLY');
  const [newSeverity, setNewSeverity] = useState('HIGH');
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newRelatedCode, setNewRelatedCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchExceptions = () => {
    setLoading(true);
    fetch('/api/procurement/exceptions')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load exceptions');
        return res.json();
      })
      .then((data) => {
        if (data?.exceptions) {
          setExceptions(data.exceptions);
        }
      })
      .catch((err) => {
        console.error('Error fetching exceptions:', err);
        showToast('Error loading procurement exceptions');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchExceptions();
  }, []);

  const handleResolve = async () => {
    if (!selectedException) return;
    if (!resolutionAction.trim() || !resolutionNotes.trim()) {
      showToast('Resolution action and detailed audit notes are strictly required.');
      return;
    }

    setIsResolving(true);
    try {
      const res = await fetch(`/api/procurement/exceptions/${selectedException.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'RESOLVED',
          resolutionAction,
          resolutionNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to resolve exception');

      showToast(`Exception ${selectedException.exceptionCode} resolved. Audit log updated.`);
      setIsResolveModalOpen(false);
      setSelectedException(null);
      setResolutionNotes('');
      fetchExceptions();
      if (onReviewRecovery) onReviewRecovery(selectedException.exceptionCode);
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    } finally {
      setIsResolving(false);
    }
  };

  const handleCreate = async () => {
    if (!newTitle.trim() || !newDesc.trim()) {
      showToast('Title and description are required.');
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch('/api/procurement/exceptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exceptionType: newType,
          severity: newSeverity,
          title: newTitle.trim(),
          description: newDesc.trim(),
          relatedCode: newRelatedCode.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create exception');

      showToast(`Exception ${data.exception.exceptionCode} logged.`);
      setIsCreateModalOpen(false);
      setNewTitle('');
      setNewDesc('');
      setNewRelatedCode('');
      fetchExceptions();
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  const openCount = exceptions.filter((e) => e.status === 'OPEN' || e.status === 'IN_PROGRESS').length;
  const criticalCount = exceptions.filter((e) => e.severity === 'CRITICAL' && e.status !== 'RESOLVED').length;

  const filtered = exceptions.filter((e) => {
    if (filter === 'ALL') return true;
    if (filter === 'OPEN') return e.status === 'OPEN' || e.status === 'IN_PROGRESS';
    if (filter === 'RESOLVED') return e.status === 'RESOLVED';
    if (filter === 'HIGH') return e.severity === 'HIGH' || e.severity === 'CRITICAL';
    return true;
  });

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
          <h1>Exceptions &amp; Delivery Recovery</h1>
          <p>
            {openCount} Active procurement issues requiring buyer resolution and auditable record
          </p>
        </div>
        <div className="head-actions">
          <button className="btn btn-secondary" onClick={fetchExceptions} title="Refresh exceptions">
            <RefreshCw size={13} style={{ marginRight: '6px' }} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={() => setIsCreateModalOpen(true)}>
            <Plus size={14} style={{ marginRight: '4px' }} /> Log Exception
          </button>
        </div>
      </div>

      {/* Metric Counters */}
      <div className="grid metrics" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: '20px' }}>
        <div className="metric">
          <div className="metric-top">Open exceptions</div>
          <strong>{loading ? '...' : openCount}</strong>
          <small>{openCount === 0 ? 'All site issues reconciled' : 'Action required'}</small>
        </div>
        <div className="metric">
          <div className="metric-top">Critical shortfalls</div>
          <strong style={{ color: criticalCount > 0 ? '#b91c1c' : '#15803d' }}>
            {loading ? '...' : criticalCount}
          </strong>
          <small>Rolling cycle / stock shortfalls</small>
        </div>
        <div className="metric">
          <div className="metric-top">Resolved with audit</div>
          <strong style={{ color: '#15803d' }}>
            {loading ? '...' : exceptions.filter((e) => e.status === 'RESOLVED').length}
          </strong>
          <small>Documented recovery decisions</small>
        </div>
      </div>

      {/* Exceptions Table Panel */}
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Exception Registry ({filtered.length})</h2>
            <p>Auditable resolution tracking for quality, logistics, and pricing variances</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select
              className="filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              aria-label="Filter exceptions"
            >
              <option value="ALL">All records ({exceptions.length})</option>
              <option value="OPEN">Open &amp; In Progress ({openCount})</option>
              <option value="HIGH">High &amp; Critical Severity</option>
              <option value="RESOLVED">Resolved</option>
            </select>
          </div>
        </div>

        <div className="table-wrap">
          {loading ? (
            <div style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>Loading exceptions...</div>
          ) : exceptions.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', color: '#64748b' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  background: '#f1f5f9',
                  display: 'grid',
                  placeItems: 'center',
                  margin: '0 auto 12px',
                  padding: '9px',
                }}
              >
                <Image
                  src="/images/kovok-logo.png"
                  alt="Kovok"
                  width={26}
                  height={26}
                  style={{ width: '26px', height: '26px', objectFit: 'contain' }}
                />
              </div>
              <strong style={{ display: 'block', fontSize: '14px', color: '#1e293b', marginBottom: '6px' }}>
                No active procurement exceptions
              </strong>
              <p style={{ maxWidth: '440px', margin: '0 auto', fontSize: '12px' }}>
                When delivery variances, rolling weight shortfalls, or damaged materials are logged, they will appear here with an auditable resolution trail.
              </p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Issue &amp; Related Record</th>
                  <th>Severity</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => {
                  const isResolved = e.status === 'RESOLVED';
                  const isHigh = e.severity === 'HIGH' || e.severity === 'CRITICAL';

                  return (
                    <tr
                      key={e.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        setSelectedException(e);
                        setIsResolveModalOpen(true);
                      }}
                    >
                      <td>
                        <strong style={{ color: '#1e40af' }}>{e.exceptionCode}</strong>
                        <span className="sub">
                          {new Date(e.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </span>
                      </td>
                      <td>
                        <strong>{e.title}</strong>
                        <span className="sub">
                          {e.exceptionType.replace(/_/g, ' ')} &middot; Ref: {e.relatedCode || 'Unlinked'}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`pill ${isHigh ? 'red' : 'amber'}`}
                          style={{ fontSize: '10px' }}
                        >
                          {e.severity}
                        </span>
                      </td>
                      <td style={{ maxWidth: '340px' }}>
                        <span style={{ fontSize: '12px', color: '#334155', lineHeight: 1.4, display: 'block' }}>
                          {e.description}
                        </span>
                        {isResolved && e.resolutionAction && (
                          <span style={{ fontSize: '11px', color: '#15803d', marginTop: '2px', display: 'block' }}>
                            Resolved: {e.resolutionAction}
                          </span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`pill ${isResolved ? 'green' : isHigh ? 'red' : 'amber'}`}
                          style={{ fontSize: '10px' }}
                        >
                          <span className="dot"></span>
                          {e.status}
                        </span>
                      </td>
                      <td>
                        <button
                          className="row-action"
                          onClick={(evt) => {
                            evt.stopPropagation();
                            setSelectedException(e);
                            setIsResolveModalOpen(true);
                          }}
                        >
                          {isResolved ? 'Inspect Audit →' : 'Resolve Exception →'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Resolve Exception Modal */}
      {isResolveModalOpen && selectedException && (
        <div
          className="modal-backdrop"
          onClick={(e) => e.target === e.currentTarget && !isResolving && setIsResolveModalOpen(false)}
        >
          <div className="modal" style={{ maxWidth: '580px' }}>
            <div className="modal-head">
              <div>
                <div className="eyebrow">AUDITABLE RESOLUTION WORKFLOW</div>
                <h2>{selectedException.exceptionCode} &middot; {selectedException.title}</h2>
                <p>Related: {selectedException.relatedCode || 'General'} &middot; Type: {selectedException.exceptionType.replace(/_/g, ' ')}</p>
              </div>
              <button className="icon-btn" onClick={() => !isResolving && setIsResolveModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="wizard-main">
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  marginBottom: '16px',
                  fontSize: '12.5px',
                  lineHeight: 1.45,
                }}
              >
                <strong>Issue Description:</strong>
                <p style={{ margin: '4px 0 0', color: '#334155' }}>{selectedException.description}</p>
              </div>

              {selectedException.status === 'RESOLVED' ? (
                <div
                  style={{
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '8px',
                    padding: '14px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <CheckCircle2 size={16} className="text-green-600" />
                    <strong style={{ color: '#15803d', fontSize: '13px' }}>Resolved &amp; Committed to Audit Trail</strong>
                  </div>
                  <div className="kv">
                    <span>Resolution Action</span>
                    <strong>{selectedException.resolutionAction}</strong>
                  </div>
                  <div className="kv">
                    <span>Audit Notes</span>
                    <span>{selectedException.resolutionNotes}</span>
                  </div>
                  <div className="kv">
                    <span>Resolved Date</span>
                    <span>{selectedException.resolvedAt ? new Date(selectedException.resolvedAt).toLocaleString('en-IN') : 'Completed'}</span>
                  </div>
                </div>
              ) : (
                <>
                  <div className="field" style={{ marginBottom: '14px' }}>
                    <label>Resolution Action Strategy</label>
                    <select
                      value={resolutionAction}
                      onChange={(e) => setResolutionAction(e.target.value)}
                      disabled={isResolving}
                      aria-label="Resolution Action Strategy"
                    >
                      <option>Alternative Vendor Sourcing</option>
                      <option>Split Delivery: Accept partial now, balance next rolling</option>
                      <option>Authorize Night Site Offloading Clearance</option>
                      <option>Disqualify Quote as Non-Responsive</option>
                      <option>Shortfall Cancellation &amp; Close PO</option>
                      <option>Re-rate Commercial Invoice to Stated Quotation</option>
                    </select>
                  </div>

                  <div className="field" style={{ marginBottom: '14px' }}>
                    <label>Auditable Resolution Note &amp; Justification (Required)</label>
                    <textarea
                      placeholder="e.g. Authorized emergency dispatch of 8 MT Fe 500D from Shakti Steel stockyard to prevent pour delay."
                      value={resolutionNotes}
                      onChange={(e) => setResolutionNotes(e.target.value)}
                      disabled={isResolving}
                      rows={3}
                    />
                    <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                      Strict Invariant: System will reject resolution without documented reason and actor identity.
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className="wizard-footer">
              <button
                className="btn btn-secondary"
                disabled={isResolving}
                onClick={() => setIsResolveModalOpen(false)}
              >
                Close
              </button>
              {selectedException.status !== 'RESOLVED' && (
                <button
                  className="btn btn-primary"
                  disabled={isResolving}
                  onClick={handleResolve}
                >
                  {isResolving ? 'Committing Resolution...' : 'Commit Resolution & Update Audit'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Log New Exception Modal */}
      {isCreateModalOpen && (
        <div
          className="modal-backdrop"
          onClick={(e) => e.target === e.currentTarget && !isCreating && setIsCreateModalOpen(false)}
        >
          <div className="modal" style={{ maxWidth: '540px' }}>
            <div className="modal-head">
              <div>
                <div className="eyebrow">NEW PROCUREMENT EXCEPTION</div>
                <h2>Log Procurement Issue</h2>
                <p>Record a shortfall, specification variance, or delivery delay</p>
              </div>
              <button className="icon-btn" onClick={() => !isCreating && setIsCreateModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="wizard-main">
              <div className="form-grid" style={{ marginBottom: '14px' }}>
                <div className="field">
                  <label>Exception Type</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    disabled={isCreating}
                    aria-label="Exception Type"
                  >
                    <option value="SHORT_SUPPLY">Short Supply</option>
                    <option value="DELAYED_DELIVERY">Delayed Delivery</option>
                    <option value="SPEC_MISMATCH">Specification Mismatch</option>
                    <option value="DAMAGED_MATERIAL">Damaged Material</option>
                    <option value="MISSING_DOCUMENTATION">Missing Documentation (MTC)</option>
                    <option value="PRICING_DISCREPANCY">Pricing Discrepancy</option>
                    <option value="SUPPLIER_CANCELLATION">Supplier Cancellation</option>
                    <option value="OTHER">Other Issue</option>
                  </select>
                </div>

                <div className="field">
                  <label>Severity</label>
                  <select
                    value={newSeverity}
                    onChange={(e) => setNewSeverity(e.target.value)}
                    disabled={isCreating}
                    aria-label="Severity"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
              </div>

              <div className="field" style={{ marginBottom: '14px' }}>
                <label>Related Requisition or PO Number (Optional)</label>
                <input
                  placeholder="e.g. PO-0261 or KOV-REQ-0001"
                  value={newRelatedCode}
                  onChange={(e) => setNewRelatedCode(e.target.value)}
                  disabled={isCreating}
                />
              </div>

              <div className="field" style={{ marginBottom: '14px' }}>
                <label>Issue Title</label>
                <input
                  placeholder="e.g. 8 tonnes rolling cycle delay from mill"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  disabled={isCreating}
                />
              </div>

              <div className="field" style={{ marginBottom: '14px' }}>
                <label>Detailed Description</label>
                <textarea
                  placeholder="Provide precise details of the material shortfall, vehicle problem, or certificate mismatch..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  disabled={isCreating}
                  rows={3}
                />
              </div>
            </div>

            <div className="wizard-footer">
              <button
                className="btn btn-secondary"
                disabled={isCreating}
                onClick={() => setIsCreateModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                disabled={isCreating}
                onClick={handleCreate}
              >
                {isCreating ? 'Logging...' : 'Submit Exception'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
