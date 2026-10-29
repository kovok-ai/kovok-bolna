'use client';

import React, { useState } from 'react';

interface RequestsViewProps {
  onOpenRequest: (requestCode: string) => void;
  onImport?: () => void;
}

export function RequestsView({ onOpenRequest, onImport }: RequestsViewProps) {
  const [filter, setFilter] = useState('All statuses');

  const allRequests = [
    { code: 'KOV-1028', spec: 'TMT steel · Fe 550D · 12 mm', qty: '20 tonnes · Gurugram', date: 'Nov 2, 2026', status: 'Quotes ready', statusColor: 'blue', offers: '3 offers' },
    { code: 'KOV-1027', spec: 'OPC 53 cement · 50 kg', qty: '300 bags · Dwarka', date: 'Oct 30, 2026', status: 'Awaiting approval', statusColor: 'amber', offers: '2 offers' },
    { code: 'KOV-1026', spec: 'TMT steel · Fe 500D · 16 mm', qty: '8 tonnes · Noida', date: 'Oct 31, 2026', status: 'Supplier call pending', statusColor: 'amber', offers: '1 of 3' },
    { code: 'KOV-1025', spec: 'PPC cement · 50 kg', qty: '500 bags · Gurugram', date: 'Nov 1, 2026', status: 'Order confirmed', statusColor: 'green', offers: 'Selected supplier' },
    { code: 'KOV-1024', spec: 'M-sand · Zone II', qty: '2 truckloads · Faridabad', date: 'Oct 29, 2026', status: 'Needs clarification', statusColor: 'red', offers: 'Quantity/unit' },
    { code: 'KOV-1023', spec: 'TMT steel · Fe 550D · 10 mm', qty: '5 tonnes · Delhi', date: 'Oct 28, 2026', status: 'Delivered · inspect', statusColor: 'blue', offers: 'Receipt pending' },
  ];

  const filtered = allRequests.filter((r) => {
    if (filter === 'All statuses') return true;
    return r.status === filter;
  });

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Requests</h1>
          <p>{allRequests.length} requests · 2 need attention</p>
        </div>
        <div className="head-actions">
          <button className="btn btn-secondary" onClick={onImport}>
            Import
          </button>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2>All requests</h2>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select
              className="filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              aria-label="Filter requests by status"
            >
              <option>All statuses</option>
              <option>Quotes ready</option>
              <option>Needs clarification</option>
              <option>Awaiting approval</option>
            </select>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Request</th>
                <th>Material specification</th>
                <th>Quantity · site</th>
                <th>Required by</th>
                <th>Status</th>
                <th>Offers</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.code}>
                  <td>
                    <strong>{r.code}</strong>
                    <span className="sub">
                      {r.spec.startsWith('TMT') ? 'Material request' : 'Purchase request'}
                    </span>
                  </td>
                  <td>
                    <strong>{r.spec}</strong>
                  </td>
                  <td>{r.qty}</td>
                  <td>{r.date}</td>
                  <td>
                    <span className={`pill ${r.statusColor}`}>
                      <span className="dot"></span>
                      {r.status}
                    </span>
                  </td>
                  <td>{r.offers}</td>
                  <td>
                    <button
                      className="row-action"
                      onClick={() => onOpenRequest(r.code)}
                    >
                      Open →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
