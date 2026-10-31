'use client';

import React, { useState, useEffect } from 'react';

interface OverviewRequestItem {
  id: string;
  requestCode: string;
  materialCategoryId: string;
  targetGrade: string | null;
  targetDiameterMm: number | null;
  quantityValue: number;
  quantityUnit: string;
  requestStatus: string;
  createdAt: string;
  site: {
    siteName: string;
    city: string;
    pinCode: string;
  };
  canonicalProduct: {
    canonicalName: string;
    applicableStandard: string;
  } | null;
  materialCategory: {
    categoryName: string;
  };
}

interface OverviewViewProps {
  onNavigate: (page: string) => void;
  onOpenNewRequest?: (params?: { category: 'tmt_rebar' | 'cement'; grade?: string; diameter?: string }) => void;
  onOpenRequest?: (requestCode: string) => void;
  workspaceSubtitle?: string;
}

export function OverviewView({
  onNavigate,
  onOpenNewRequest,
  onOpenRequest,
  workspaceSubtitle = 'Delhi NCR · 2 sites',
}: OverviewViewProps) {
  const [requests, setRequests] = useState<OverviewRequestItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/procurement/requests')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load requests');
        return res.json();
      })
      .then((data) => {
        if (data?.requests) {
          setRequests(data.requests);
        }
      })
      .catch((err) => console.error('Error fetching overview requests:', err))
      .finally(() => setLoading(false));
  }, []);

  const verifiedCount = requests.filter((r) => r.requestStatus === 'MATCHED_VERIFIED').length;
  const clarificationCount = requests.filter((r) => r.requestStatus === 'NEEDS_CLARIFICATION').length;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Procurement Overview</h1>
          <p>{workspaceSubtitle} · Multi-tenant construction procurement engine</p>
        </div>
        <div className="head-actions">
          {onOpenNewRequest && (
            <button className="btn btn-primary" onClick={() => onOpenNewRequest()}>
              + New Request
            </button>
          )}
        </div>
      </div>

      {/* 4 Real Metric Counters */}
      <div className="grid metrics">
        <div className="metric">
          <div className="metric-top">Open requests</div>
          <strong>{requests.length}</strong>
          <small>{clarificationCount > 0 ? `${clarificationCount} need clarification` : 'All specifications routed'}</small>
        </div>
        <div className="metric">
          <div className="metric-top">Verified matches</div>
          <strong style={{ color: '#15803d' }}>{verifiedCount}</strong>
          <small>Conforming to BIS standards</small>
        </div>
        <div className="metric">
          <div className="metric-top">Clarifications</div>
          <strong style={{ color: clarificationCount > 0 ? '#b45309' : 'inherit' }}>{clarificationCount}</strong>
          <small>Non-standard / unlisted sizes</small>
        </div>
        <div className="metric">
          <div className="metric-top">Catalogue products</div>
          <strong>43</strong>
          <small>18 Core verified · 25 Provisional</small>
        </div>
      </div>

      {/* Core Buyer Intake Category Cards */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 650, margin: '0 0 12px', color: '#1e293b' }}>
          Select Material Category to Initiate Procurement
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '14px',
          }}
        >
          {/* Card 1: TMT Steel */}
          <div
            className="panel"
            style={{
              padding: '18px',
              border: '1px solid #dbeafe',
              background: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              cursor: 'pointer',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            }}
            onClick={() => onOpenNewRequest && onOpenNewRequest({ category: 'tmt_rebar', grade: 'Fe 500D', diameter: '12' })}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span className="pill blue">IS 1786:2008</span>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Primary Construction</span>
              </div>
              <h3 style={{ margin: '0 0 6px', fontSize: '15px', color: '#1e3a8a' }}>
                TMT Reinforcement Steel
              </h3>
              <p style={{ margin: '0 0 12px', fontSize: '11.5px', color: '#475569', lineHeight: 1.45 }}>
                Grades Fe 500D & Fe 550D across standard sizes (8mm – 32mm). Real-time theoretical mass, 12m bar count conversions, and tolerance verification.
              </p>
            </div>
            <button
              className="btn btn-secondary"
              style={{ width: '100%', borderColor: '#bfdbfe', color: '#1e40af' }}
              onClick={(e) => {
                e.stopPropagation();
                if (onOpenNewRequest) onOpenNewRequest({ category: 'tmt_rebar', grade: 'Fe 500D', diameter: '12' });
              }}
            >
              + Procure TMT Steel →
            </button>
          </div>

          {/* Card 2: Cement */}
          <div
            className="panel"
            style={{
              padding: '18px',
              border: '1px solid #fee2e2',
              background: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              cursor: 'pointer',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            }}
            onClick={() => onOpenNewRequest && onOpenNewRequest({ category: 'cement', grade: 'OPC 53' })}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span className="pill green">IS 269 / 1489 / 455</span>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Hydraulic Binders</span>
              </div>
              <h3 style={{ margin: '0 0 6px', fontSize: '15px', color: '#991b1b' }}>
                Cement & Mineral Binders
              </h3>
              <p style={{ margin: '0 0 12px', fontSize: '11.5px', color: '#475569', lineHeight: 1.45 }}>
                OPC 53, PPC Fly Ash, and PSC Slag. 50 kg HDPE bags or bulk tankers with automatic IS 456 durability advisory checks for coastal and marine foundation works.
              </p>
            </div>
            <button
              className="btn btn-secondary"
              style={{ width: '100%', borderColor: '#fecaca', color: '#991b1b' }}
              onClick={(e) => {
                e.stopPropagation();
                if (onOpenNewRequest) onOpenNewRequest({ category: 'cement', grade: 'OPC 53' });
              }}
            >
              + Procure Cement →
            </button>
          </div>

          {/* Card 3: Full Catalogue */}
          <div
            className="panel"
            style={{
              padding: '18px',
              border: '1px solid #e2e8f0',
              background: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              cursor: 'pointer',
            }}
            onClick={() => onNavigate('catalog')}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span className="pill">43 Products</span>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Curated Specifications</span>
              </div>
              <h3 style={{ margin: '0 0 6px', fontSize: '15px', color: '#1e293b' }}>
                Standard Product Catalogue
              </h3>
              <p style={{ margin: '0 0 12px', fontSize: '11.5px', color: '#475569', lineHeight: 1.45 }}>
                Inspect 18 verified canonical specifications, 25 provisional project-rolling specifications, mandatory attributes, and BIS statutory test citations.
              </p>
            </div>
            <button
              className="btn btn-secondary"
              style={{ width: '100%' }}
              onClick={(e) => {
                e.stopPropagation();
                onNavigate('catalog');
              }}
            >
              Browse Catalogue →
            </button>
          </div>
        </div>
      </div>

      {/* Recent Procurement Table (Real Database Records) */}
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Recent Procurement Intake</h2>
            <p>Live requests recorded in PostgreSQL workspace outbox</p>
          </div>
          <button className="btn btn-quiet" onClick={() => onNavigate('requests')}>
            All requests <span aria-hidden="true">→</span>
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
            Loading recent requests...
          </div>
        ) : requests.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
            No procurement requests recorded yet. Select a category above to submit your first requirement.
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Request Code</th>
                  <th>Material & Specification</th>
                  <th>Quantity · Destination</th>
                  <th>Submission Date</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {requests.slice(0, 5).map((r) => {
                  const isVerified = r.requestStatus === 'MATCHED_VERIFIED';
                  const isSteel =
                    r.materialCategoryId === 'tmt_rebar' || r.materialCategoryId === 'CAT-TMT-STEEL';
                  const spec = isSteel
                    ? `TMT Steel ${r.targetGrade ?? ''} · ${r.targetDiameterMm ? `${r.targetDiameterMm} mm` : ''}`
                    : `Cement ${r.targetGrade ?? ''}`;

                  return (
                    <tr
                      key={r.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        onNavigate('requests');
                        if (onOpenRequest) onOpenRequest(r.requestCode);
                      }}
                    >
                      <td>
                        <strong style={{ color: '#1e40af' }}>{r.requestCode}</strong>
                        <span className="sub">{r.materialCategory.categoryName}</span>
                      </td>
                      <td>
                        <strong>{spec}</strong>
                        {r.canonicalProduct && (
                          <span className="sub">{r.canonicalProduct.canonicalName}</span>
                        )}
                      </td>
                      <td>
                        <strong>
                          {r.quantityValue} {r.quantityUnit}
                        </strong>
                        <span className="sub">
                          {r.site.siteName} ({r.site.city})
                        </span>
                      </td>
                      <td>
                        {new Date(r.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td>
                        <span className={`pill ${isVerified ? 'green' : 'amber'}`}>
                          <span className="dot"></span>
                          {isVerified ? 'Verified Match' : 'Clarification Required'}
                        </span>
                      </td>
                      <td>
                        <button
                          className="row-action"
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigate('requests');
                            if (onOpenRequest) onOpenRequest(r.requestCode);
                          }}
                        >
                          View →
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
    </div>
  );
}
