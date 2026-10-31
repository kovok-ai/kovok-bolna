'use client';

import React, { useState, useEffect, useCallback } from 'react';
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

  const filtered = requests.filter((r) => {
    if (filter === 'ALL') return true;
    return r.requestStatus === filter;
  });

  const verifiedCount = requests.filter((r) => r.requestStatus === 'MATCHED_VERIFIED').length;
  const clarificationCount = requests.filter((r) => r.requestStatus === 'NEEDS_CLARIFICATION').length;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Procurement Requests</h1>
          <p>
            {requests.length} Total Requests · {verifiedCount} Verified Standard Matches · {clarificationCount} Requiring Clarification
          </p>
        </div>
        <div className="head-actions">
          <button className="btn btn-secondary" onClick={fetchRequests} title="Refresh requests list">
            ↻ Refresh
          </button>
          {onNewRequest && (
            <button className="btn btn-primary" onClick={onNewRequest}>
              + New Request
            </button>
          )}
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>All Requests ({filtered.length})</h2>
            <p>Committed to PostgreSQL under strict tenant Row-Level Security isolation</p>
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
                fontSize: '20px',
              }}
            >
              📋
            </div>
            <strong style={{ display: 'block', fontSize: '14px', color: '#1e293b', marginBottom: '6px' }}>
              No procurement requests yet
            </strong>
            <p style={{ maxWidth: '420px', margin: '0 auto 16px', fontSize: '12px' }}>
              Create your first procurement intake for TMT Steel or Cement to initiate automated catalogue resolution and supplier sourcing.
            </p>
            {onNewRequest && (
              <button className="btn btn-primary" onClick={onNewRequest}>
                + Create First Request
              </button>
            )}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Request Code</th>
                  <th>Material & Specification</th>
                  <th>Quantity · Destination</th>
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
                          View Details →
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
          <div className="modal" style={{ maxWidth: '620px' }}>
            <div className="modal-head">
              <div>
                <div className="eyebrow">
                  PROCUREMENT REQUEST DETAILS · {selectedRequest.requestCode}
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
                ×
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
                        {visual.applicableStandard} · {visual.attribution}
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
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color:
                        selectedRequest.requestStatus === 'MATCHED_VERIFIED' ? '#15803d' : '#b45309',
                    }}
                  >
                    {selectedRequest.requestStatus === 'MATCHED_VERIFIED'
                      ? '✓ VERIFIED CANONICAL SPECIFICATION'
                      : '⚠ TECHNICAL CLARIFICATION REQUIRED'}
                  </span>
                  <div style={{ fontSize: '12px', color: '#334155', marginTop: '2px' }}>
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

              {/* Conversions (for Steel) */}
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
                  <span>City & Pin Code</span>
                  <strong>
                    {selectedRequest.site.city} — {selectedRequest.site.pinCode}
                  </strong>
                </div>
                {selectedRequest.site.address && (
                  <div className="kv">
                    <span>Address</span>
                    <span>{selectedRequest.site.address}</span>
                  </div>
                )}
              </div>

              {/* Sourcing & Voice Workflow Status Banner */}
              <div
                style={{
                  border: '1px solid #dbeafe',
                  background: '#eff6ff',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  fontSize: '11px',
                  color: '#1e40af',
                }}
              >
                <strong>Sourcing Workflow Status:</strong>
                <p style={{ margin: '4px 0 0', lineHeight: 1.45 }}>
                  Procurement request is committed to the workspace outbox. Automated quote intake and Sarvam AI voice agent outreach will query verified regional stockists within permitted calling hours (10:00 - 18:00 IST).
                </p>
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
    </div>
  );
}
