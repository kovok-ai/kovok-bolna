'use client';

import React, { useState, useEffect } from 'react';

interface ProcurementRequestItem {
  id: string;
  requestCode: string;
  materialCategoryId: string;
  targetGrade: string | null;
  targetDiameterMm: number | null;
  quantityValue: number;
  quantityUnit: string;
  requestStatus: string;
  clarificationReason: string | null;
  createdAt: string;
  site: {
    id: string;
    siteName: string;
    pinCode: string;
    city: string;
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
  onOpenRequest: (requestCode: string) => void;
  onImport?: () => void;
}

export function RequestsView({ onOpenRequest, onImport }: RequestsViewProps) {
  // Preserved Phase 1 baseline sample requests for fallback display
  const allRequests = [
    { code: 'KOV-1028', spec: 'TMT steel · Fe 550D · 12 mm', qty: '20 tonnes · Gurugram', status: 'Quotes ready', statusColor: 'blue', offers: '3 offers' },
    { code: 'KOV-1027', spec: 'OPC 53 cement · 50 kg', qty: '300 bags · Dwarka', status: 'Awaiting approval', statusColor: 'amber', offers: '2 offers' },
  ];

  const [requests, setRequests] = useState<ProcurementRequestItem[]>([]);
  const [filter, setFilter] = useState('ALL');
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
      .catch((err) => console.error('Error fetching procurement requests:', err))
      .finally(() => setLoading(false));
  }, []);

  const filtered = requests.filter((r) => {
    if (filter === 'ALL') return true;
    return r.requestStatus === filter;
  });

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Procurement Requests</h1>
          <p>{requests.length} requests · Workspace-isolated intake</p>
        </div>
        <div className="head-actions">
          <button className="btn btn-secondary" onClick={onImport}>
            Import Intake
          </button>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2>All Requests ({filtered.length})</h2>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select
              className="filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              aria-label="Filter requests by status"
            >
              <option value="ALL">All statuses</option>
              <option value="MATCHED_VERIFIED">Matched Verified</option>
              <option value="NEEDS_CLARIFICATION">Needs Clarification</option>
              <option value="DRAFT">Draft</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
            Loading procurement requests...
          </div>
        ) : requests.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
            No procurement requests submitted yet. Click <strong>+ New Request</strong> in the topbar to initiate procurement.
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Material Specification</th>
                  <th>Quantity · Destination Site</th>
                  <th>Status</th>
                  <th>Match Result / Clarification</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const isVerified = r.requestStatus === 'MATCHED_VERIFIED';
                  const spec =
                    r.materialCategoryId === 'tmt_rebar' || r.materialCategoryId === 'CAT-TMT-STEEL'
                      ? `TMT Steel ${r.targetGrade ?? ''} · ${r.targetDiameterMm ?? ''} mm`
                      : `Cement ${r.targetGrade ?? ''}`;

                  return (
                    <tr key={r.id}>
                      <td>
                        <strong>{r.requestCode}</strong>
                        <span className="sub">{r.materialCategory.categoryName}</span>
                      </td>
                      <td>
                        <strong>{spec}</strong>
                        {r.canonicalProduct && (
                          <span className="sub">{r.canonicalProduct.canonicalName}</span>
                        )}
                      </td>
                      <td>
                        {r.quantityValue} {r.quantityUnit}
                        <span className="sub">
                          {r.site.siteName} ({r.site.city} - {r.site.pinCode})
                        </span>
                      </td>
                      <td>
                        <span className={`pill ${isVerified ? 'green' : 'amber'}`}>
                          <span className="dot"></span>
                          {r.requestStatus === 'MATCHED_VERIFIED' ? 'Verified Match' : 'Clarification Required'}
                        </span>
                      </td>
                      <td style={{ maxWidth: '300px' }}>
                        {isVerified ? (
                          <span style={{ fontSize: '11px', color: '#15803d' }}>
                            Conforms to standard {r.canonicalProduct?.applicableStandard}
                          </span>
                        ) : (
                          <span style={{ fontSize: '11px', color: '#b45309' }}>
                            {r.clarificationReason ?? 'Awaiting engineering review'}
                          </span>
                        )}
                      </td>
                      <td>
                        <button
                          className="row-action"
                          onClick={() => onOpenRequest(r.requestCode)}
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
