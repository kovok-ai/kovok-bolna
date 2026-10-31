'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import {
  FileText,
  PhoneCall,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  RefreshCw,
  Plus,
  X,
  Building2,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { getProductVisualAsset } from '@/lib/catalogue/product-images';

export interface ProcurementRequestItem {
  id: string;
  requestCode: string;
  materialCategoryId: string;
  targetGrade: string | null;
  targetDiameterMm: number | null;
  quantityValue: number;
  quantityUnit: string;
  requestStatus: string;
  clarificationReason: string | null;
  buyerNotes: string | null;
  derivedCalculations: Record<string, any> | null;
  createdAt: string;
  site: {
    id: string;
    siteName: string;
    pinCode: string;
    city: string;
    address?: string;
  };
  canonicalProduct: {
    id: string;
    canonicalName: string;
    applicableStandard: string;
  } | null;
  materialCategory: {
    id: string;
    categoryName: string;
  };
  calls?: any[];
  quotations?: any[];
}

interface RequestsViewProps {
  onOpenRequest?: (requestCode: string) => void;
  onNewRequest?: () => void;
  refreshTrigger?: number;
  initialSelectedCode?: string | null;
}

export function RequestsView({
  onOpenRequest,
  onNewRequest,
  refreshTrigger = 0,
  initialSelectedCode = null,
}: RequestsViewProps) {
  const [requests, setRequests] = useState<ProcurementRequestItem[]>([]);
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<ProcurementRequestItem | null>(null);

  // Supplier Outbound Call Modal State
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [phoneOverride, setPhoneOverride] = useState<string>('');
  const [isCalling, setIsCalling] = useState(false);
  const [callFeedback, setCallFeedback] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchRequests = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/procurement/requests')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load requests');
        return res.json();
      })
      .then((data) => {
        if (data?.requests) {
          setRequests(data.requests);
          if (initialSelectedCode) {
            const match = data.requests.find((r: ProcurementRequestItem) => r.requestCode === initialSelectedCode);
            if (match) setSelectedRequest(match);
          }
        }
      })
      .catch((err) => {
        console.error('Error fetching procurement requests:', err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [initialSelectedCode]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests, refreshTrigger]);

  // Load suppliers when call modal is opened
  useEffect(() => {
    if (isCallModalOpen && suppliers.length === 0) {
      fetch('/api/catalogue/suppliers')
        .then((res) => res.json())
        .then((data) => {
          if (data?.suppliers && data.suppliers.length > 0) {
            setSuppliers(data.suppliers);
            setSelectedSupplierId(data.suppliers[0].id);
          }
        })
        .catch((err) => console.error('Failed to load suppliers for calling:', err));
    }
  }, [isCallModalOpen, suppliers.length]);

  const handleInitiateCall = async () => {
    if (!selectedRequest || !selectedSupplierId) return;
    setIsCalling(true);
    setCallFeedback(null);

    try {
      const res = await fetch('/api/procurement/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          procurementRequestId: selectedRequest.id,
          supplierId: selectedSupplierId,
          supplierPhoneOverride: phoneOverride.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok && !data.call) {
        throw new Error(data.error || 'Failed to dispatch voice call');
      }

      if (data.success) {
        showToast(`Voice agent outbound call queued for ${data.call.supplier?.organizationName || 'supplier'}.`);
        setCallFeedback('Outbound call queued successfully. Sarvam AI agent will dial supplier.');
      } else {
        setCallFeedback(data.warning || 'Call simulated: Telephony credentials pending in environment.');
        showToast('Call logged. Telephony gateway requires configuration in production.');
      }

      // Refresh request details to show call attempt
      fetchRequests();
      setTimeout(() => {
        setIsCallModalOpen(false);
        setCallFeedback(null);
      }, 2500);
    } catch (err: any) {
      console.error('Call initiation error:', err);
      setCallFeedback(`Error: ${err.message}`);
    } finally {
      setIsCalling(false);
    }
  };

  const handleUpdateStatus = async (newStatus: 'HOLD' | 'CANCELLED') => {
    if (!selectedRequest) return;
    try {
      const res = await fetch(`/api/procurement/requests/${selectedRequest.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestStatus: newStatus }),
      });
      if (!res.ok) throw new Error('Status update failed');
      showToast(`Request ${selectedRequest.requestCode} moved to ${newStatus}.`);
      setSelectedRequest(null);
      fetchRequests();
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    }
  };

  const filtered = requests.filter((r) => {
    if (filter === 'ALL') return true;
    return r.requestStatus === filter;
  });

  const verifiedCount = requests.filter((r) => r.requestStatus === 'MATCHED_VERIFIED').length;
  const clarificationCount = requests.filter((r) => r.requestStatus === 'NEEDS_CLARIFICATION').length;

  return (
    <div>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="toast" style={{ top: '24px', zIndex: 1100 }}>
          {toastMessage}
        </div>
      )}

      <div className="page-head">
        <div>
          <h1>Procurement Requests</h1>
          <p>
            {requests.length} Total Requests &middot; {verifiedCount} Verified Standard Matches &middot; {clarificationCount} Requiring Clarification
          </p>
        </div>
        <div className="head-actions">
          <button className="btn btn-secondary" onClick={fetchRequests} title="Refresh requests list">
            <RefreshCw size={13} style={{ marginRight: '6px' }} /> Refresh
          </button>
          {onNewRequest && (
            <button className="btn btn-primary" onClick={onNewRequest}>
              <Plus size={14} style={{ marginRight: '4px' }} /> New Request
            </button>
          )}
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>All Requisitions ({filtered.length})</h2>
            <p>Committed under strict tenant Row-Level Security isolation</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select
              className="filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              aria-label="Filter requests by status"
            >
              <option value="ALL">All statuses ({requests.length})</option>
              <option value="MATCHED_VERIFIED">Verified Matches ({verifiedCount})</option>
              <option value="NEEDS_CLARIFICATION">Needs Clarification ({clarificationCount})</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
            Loading procurement requests...
          </div>
        ) : error ? (
          <div style={{ padding: '24px' }} className="alert">
            Error loading requests: {error}
          </div>
        ) : requests.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: '#64748b' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: '#f1f5f9',
                display: 'grid',
                placeItems: 'center',
                margin: '0 auto 12px',
                padding: '10px',
              }}
            >
              <Image
                src="/images/kovok-logo.png"
                alt="Kovok"
                width={28}
                height={28}
                style={{ width: '28px', height: '28px', objectFit: 'contain' }}
              />
            </div>
            <strong style={{ display: 'block', fontSize: '14px', color: '#1e293b', marginBottom: '6px' }}>
              No procurement requests yet
            </strong>
            <p style={{ maxWidth: '420px', margin: '0 auto 16px', fontSize: '12px' }}>
              Create your first procurement intake for TMT Steel or Cement to initiate automated catalogue resolution and supplier sourcing.
            </p>
            {onNewRequest && (
              <button className="btn btn-primary" onClick={onNewRequest}>
                <Plus size={14} style={{ marginRight: '4px' }} /> Create First Request
              </button>
            )}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Request Code</th>
                  <th>Material &amp; Specification</th>
                  <th>Quantity &middot; Destination</th>
                  <th>Status</th>
                  <th>Catalogue Match / Clarification</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const isVerified = r.requestStatus === 'MATCHED_VERIFIED';
                  const isSteel =
                    r.materialCategoryId === 'tmt_rebar' || r.materialCategoryId === 'CAT-TMT-STEEL';
                  const spec = isSteel
                    ? `TMT Steel ${r.targetGrade ?? ''} · ${r.targetDiameterMm ? `${r.targetDiameterMm} mm` : ''}`
                    : `Cement ${r.targetGrade ?? ''}`;
                  const visual = getProductVisualAsset(r.canonicalProduct?.id, r.materialCategoryId);

                  return (
                    <tr
                      key={r.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        setSelectedRequest(r);
                        if (onOpenRequest) onOpenRequest(r.requestCode);
                      }}
                    >
                      <td>
                        <strong style={{ color: '#1e40af' }}>{r.requestCode}</strong>
                        <span className="sub">
                          {new Date(r.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '6px',
                              overflow: 'hidden',
                              border: '1px solid #cbd5e1',
                              background: '#0f172a',
                              flex: 'none',
                            }}
                          >
                            <img
                              src={visual.imagePath}
                              alt={spec}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          </div>
                          <div>
                            <strong>{spec}</strong>
                            {r.canonicalProduct ? (
                              <span className="sub" style={{ color: '#166534' }}>
                                {r.canonicalProduct.canonicalName}
                              </span>
                            ) : (
                              <span className="sub" style={{ color: '#b45309' }}>
                                {r.materialCategory.categoryName}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <strong>
                          {r.quantityValue} {r.quantityUnit}
                        </strong>
                        <span className="sub">
                          {r.site.siteName} ({r.site.city} - {r.site.pinCode})
                        </span>
                      </td>
                      <td>
                        <span className={`pill ${isVerified ? 'green' : 'amber'}`}>
                          <span className="dot"></span>
                          {isVerified ? 'Verified Match' : 'Clarification Required'}
                        </span>
                      </td>
                      <td style={{ maxWidth: '300px' }}>
                        {isVerified ? (
                          <div style={{ fontSize: '11px', color: '#15803d' }}>
                            <strong>Standard Conforming:</strong> {r.canonicalProduct?.applicableStandard || 'IS 1786 / IS 269'}
                          </div>
                        ) : (
                          <div style={{ fontSize: '11px', color: '#b45309', lineHeight: 1.35 }}>
                            {r.clarificationReason ?? 'Awaiting engineering review'}
                          </div>
                        )}
                      </td>
                      <td>
                        <button
                          className="row-action"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRequest(r);
                            if (onOpenRequest) onOpenRequest(r.requestCode);
                          }}
                        >
                          View Details &rarr;
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Request Details Drawer / Modal */}
      {selectedRequest && (
        <div
          className="modal-backdrop"
          onClick={(e) => e.target === e.currentTarget && setSelectedRequest(null)}
        >
          <div className="modal" style={{ maxWidth: '640px' }}>
            <div className="modal-head">
              <div>
                <div className="eyebrow">
                  PROCUREMENT REQUEST DETAILS &middot; {selectedRequest.requestCode}
                </div>
                <h2>
                  {selectedRequest.materialCategoryId === 'tmt_rebar'
                    ? `TMT Steel ${selectedRequest.targetGrade ?? ''} · ${selectedRequest.targetDiameterMm ?? ''}mm`
                    : `Cement ${selectedRequest.targetGrade ?? ''}`}
                </h2>
                <p>
                  Submitted on{' '}
                  {new Date(selectedRequest.createdAt).toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </p>
              </div>
              <button
                className="icon-btn"
                onClick={() => setSelectedRequest(null)}
                aria-label="Close details"
              >
                <X size={16} />
              </button>
            </div>

            <div className="wizard-main">
              {/* Product Visual Asset Banner */}
              {(() => {
                const visual = getProductVisualAsset(
                  selectedRequest.canonicalProduct?.id,
                  selectedRequest.materialCategoryId
                );
                return (
                  <div
                    style={{
                      background: '#0f172a',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      border: '1px solid #334155',
                      marginBottom: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      padding: '10px 14px',
                    }}
                  >
                    <div
                      style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '6px',
                        overflow: 'hidden',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        flex: 'none',
                      }}
                    >
                      <img
                        src={visual.imagePath}
                        alt="Product visual"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ color: '#f8fafc', fontSize: '12.5px' }}>{visual.assetTitle}</strong>
                        <span
                          className={`pill ${visual.badgeColor === 'green' ? 'green' : 'blue'}`}
                          style={{ fontSize: '9px', padding: '1px 6px' }}
                        >
                          {visual.badge}
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                        {visual.applicableStandard} &middot; {visual.attribution}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Status Header */}
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: '8px',
                  background:
                    selectedRequest.requestStatus === 'MATCHED_VERIFIED' ? '#f0fdf4' : '#fffbeb',
                  border: `1px solid ${
                    selectedRequest.requestStatus === 'MATCHED_VERIFIED' ? '#bbf7d0' : '#fde68a'
                  }`,
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {selectedRequest.requestStatus === 'MATCHED_VERIFIED' ? (
                      <CheckCircle2 size={14} className="text-green-600" />
                    ) : (
                      <AlertTriangle size={14} className="text-amber-600" />
                    )}
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color:
                          selectedRequest.requestStatus === 'MATCHED_VERIFIED' ? '#15803d' : '#b45309',
                      }}
                    >
                      {selectedRequest.requestStatus === 'MATCHED_VERIFIED'
                        ? 'VERIFIED CANONICAL SPECIFICATION'
                        : 'TECHNICAL CLARIFICATION REQUIRED'}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#334155', marginTop: '4px' }}>
                    {selectedRequest.canonicalProduct ? (
                      <>
                        Product ID: <code>{selectedRequest.canonicalProduct.id}</code> (
                        {selectedRequest.canonicalProduct.applicableStandard})
                      </>
                    ) : (
                      'Non-canonical specification awaiting regional mill confirmation'
                    )}
                  </div>
                </div>
                <span
                  className={`pill ${
                    selectedRequest.requestStatus === 'MATCHED_VERIFIED' ? 'green' : 'amber'
                  }`}
                >
                  <span className="dot"></span>
                  {selectedRequest.requestStatus}
                </span>
              </div>

              {/* Clarification alert if any */}
              {selectedRequest.clarificationReason && (
                <div className="alert" style={{ marginBottom: '16px' }}>
                  <strong>Clarification Reason:</strong>
                  <br />
                  {selectedRequest.clarificationReason}
                </div>
              )}

              {/* Technical Specifications Summary */}
              <div className="panel" style={{ padding: '14px', marginBottom: '16px' }}>
                <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: '8px', fontSize: '12px' }}>
                  Intake Specification Breakdown:
                </div>
                <div className="kv">
                  <span>Category</span>
                  <strong>{selectedRequest.materialCategory.categoryName}</strong>
                </div>
                <div className="kv">
                  <span>Quantity</span>
                  <strong>
                    {selectedRequest.quantityValue} {selectedRequest.quantityUnit}
                  </strong>
                </div>
                {selectedRequest.targetGrade && (
                  <div className="kv">
                    <span>Grade / Standard</span>
                    <strong>{selectedRequest.targetGrade}</strong>
                  </div>
                )}
                {selectedRequest.targetDiameterMm && (
                  <div className="kv">
                    <span>Nominal Diameter</span>
                    <strong>{selectedRequest.targetDiameterMm} mm</strong>
                  </div>
                )}
                {selectedRequest.buyerNotes && (
                  <div className="kv">
                    <span>Buyer Notes</span>
                    <span>{selectedRequest.buyerNotes}</span>
                  </div>
                )}
              </div>

              {/* Theoretical Rebar Conversions */}
              {selectedRequest.derivedCalculations && (
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '12px',
                    marginBottom: '16px',
                    fontSize: '11px',
                  }}
                >
                  <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: '6px' }}>
                    Engineering Theoretical Conversions (IS 1786:2008):
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                    <div>
                      Nominal Mass: <strong>{selectedRequest.derivedCalculations.nominalMassKgPerMeter} kg/m</strong>
                    </div>
                    <div>
                      12m Bar Mass: <strong>{selectedRequest.derivedCalculations.singleBarMassKg} kg</strong>
                    </div>
                    <div>
                      Bars/Tonne: <strong>{selectedRequest.derivedCalculations.theoreticalBarsPerTonne}</strong>
                    </div>
                  </div>
                  {selectedRequest.derivedCalculations.totalPiecesEstimated && (
                    <div style={{ color: '#1e40af', fontWeight: 600, marginTop: '6px' }}>
                      Estimated Count: ~{selectedRequest.derivedCalculations.totalPiecesEstimated} pieces (12m standard bars)
                    </div>
                  )}
                  <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>
                    *Final billing is based on physical weighbridge scale readings, not theoretical rebar counts.
                  </div>
                </div>
              )}

              {/* Destination Site */}
              <div className="panel" style={{ padding: '14px', marginBottom: '16px' }}>
                <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: '8px', fontSize: '12px' }}>
                  Delivery Project Site:
                </div>
                <div className="kv">
                  <span>Site Name</span>
                  <strong>{selectedRequest.site.siteName}</strong>
                </div>
                <div className="kv">
                  <span>City &amp; PIN Code</span>
                  <strong>
                    {selectedRequest.site.city} &mdash; {selectedRequest.site.pinCode}
                  </strong>
                </div>
                {selectedRequest.site.address && (
                  <div className="kv">
                    <span>Address</span>
                    <span>{selectedRequest.site.address}</span>
                  </div>
                )}
              </div>

              {/* Sourcing Actions Banner */}
              <div
                style={{
                  border: '1px solid #dbeafe',
                  background: '#eff6ff',
                  padding: '14px',
                  borderRadius: '8px',
                  marginBottom: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <PhoneCall size={16} className="text-blue-600" />
                    <strong style={{ fontSize: '13px', color: '#1e40af' }}>Sarvam Voice Sourcing</strong>
                  </div>
                  <button
                    className="btn btn-primary"
                    style={{ fontSize: '12px', padding: '6px 14px' }}
                    onClick={() => setIsCallModalOpen(true)}
                  >
                    Initiate Supplier Call
                  </button>
                </div>
                <p style={{ margin: 0, fontSize: '11.5px', color: '#3b82f6', lineHeight: 1.45 }}>
                  Trigger an automated voice agent call to gather structured quotations (base rate, GST, freight, and lead time) directly from authorized regional suppliers.
                </p>
              </div>

              {/* Workflow State Controls */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: '12px', color: '#b45309' }}
                  onClick={() => handleUpdateStatus('HOLD')}
                >
                  Hold Requisition
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: '12px', color: '#b91c1c' }}
                  onClick={() => handleUpdateStatus('CANCELLED')}
                >
                  Cancel Requisition
                </button>
              </div>
            </div>

            <div className="wizard-footer">
              <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                Request Code: {selectedRequest.requestCode}
              </span>
              <button className="btn btn-primary" onClick={() => setSelectedRequest(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Outbound Voice Call Initiation Confirmation Modal */}
      {isCallModalOpen && selectedRequest && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && !isCalling && setIsCallModalOpen(false)}>
          <div className="modal" style={{ maxWidth: '540px' }}>
            <div className="modal-head">
              <div>
                <div className="eyebrow">SARVAM VOICE TELEPHONY AGENT</div>
                <h2>Initiate Quotation Call</h2>
                <p>Requirement: {selectedRequest.requestCode} &middot; {selectedRequest.quantityValue} {selectedRequest.quantityUnit}</p>
              </div>
              <button className="icon-btn" onClick={() => !isCalling && setIsCallModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="wizard-main">
              <div className="field" style={{ marginBottom: '14px' }}>
                <label>Select Target Supplier Organization</label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  disabled={isCalling}
                  aria-label="Select target supplier"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.organizationName} ({s.supplierType.replace(/_/g, ' ')}) &mdash; {s.contactPhone || 'No phone'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field" style={{ marginBottom: '16px' }}>
                <label>Phone Number Override (Optional)</label>
                <input
                  placeholder="e.g. +919876543210 (Leave blank to use registered contact)"
                  value={phoneOverride}
                  onChange={(e) => setPhoneOverride(e.target.value)}
                  disabled={isCalling}
                />
                <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                  Valid 10-digit Indian mobile or landline starting with 6-9
                </span>
              </div>

              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '12px',
                  fontSize: '11.5px',
                  color: '#334155',
                  marginBottom: '14px',
                }}
              >
                <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: '4px' }}>
                  Voice Agent Script Summary:
                </div>
                The AI assistant will state the exact requirement ({selectedRequest.quantityValue} {selectedRequest.quantityUnit} to {selectedRequest.site.city}), collect base rate, GST rate, freight, unloading, and quote validity. Resulting quotations are marked <strong>Pending Review</strong> and must be explicitly approved by buyer.
              </div>

              {callFeedback && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    background: callFeedback.includes('Error') ? '#fef2f2' : '#f0fdf4',
                    color: callFeedback.includes('Error') ? '#b91c1c' : '#15803d',
                    border: `1px solid ${callFeedback.includes('Error') ? '#fecaca' : '#bbf7d0'}`,
                  }}
                >
                  {callFeedback}
                </div>
              )}
            </div>

            <div className="wizard-footer">
              <button
                className="btn btn-secondary"
                disabled={isCalling}
                onClick={() => setIsCallModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                disabled={isCalling}
                onClick={handleInitiateCall}
              >
                {isCalling ? 'Dispatching Call...' : 'Confirm & Place Call'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
