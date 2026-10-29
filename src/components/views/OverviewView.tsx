'use client';

import React from 'react';

interface OverviewViewProps {
  onNavigate: (page: string) => void;
  onOpenRecovery?: () => void;
  workspaceSubtitle?: string;
}

export function OverviewView({
  onNavigate,
  onOpenRecovery,
  workspaceSubtitle = 'Delhi NCR · 2 active sites',
}: OverviewViewProps) {
  const requests = [
    { code: 'KOV-1028', spec: 'TMT steel · Fe 550D · 12 mm', qty: '20 tonnes · Gurugram', date: 'Nov 2, 2026', status: 'Quotes ready', statusColor: 'blue', next: '3 offers' },
    { code: 'KOV-1027', spec: 'OPC 53 cement · 50 kg', qty: '300 bags · Dwarka', date: 'Oct 30, 2026', status: 'Awaiting approval', statusColor: 'amber', next: '2 offers' },
    { code: 'KOV-1026', spec: 'TMT steel · Fe 500D · 16 mm', qty: '8 tonnes · Noida', date: 'Oct 31, 2026', status: 'Supplier call pending', statusColor: 'amber', next: '1 of 3' },
    { code: 'KOV-1025', spec: 'PPC cement · 50 kg', qty: '500 bags · Gurugram', date: 'Nov 1, 2026', status: 'Order confirmed', statusColor: 'green', next: 'Selected supplier' },
    { code: 'KOV-1024', spec: 'M-sand · Zone II', qty: '2 truckloads · Faridabad', date: 'Oct 29, 2026', status: 'Needs clarification', statusColor: 'red', next: 'Quantity/unit' },
  ];

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Overview</h1>
          <p>{workspaceSubtitle}</p>
        </div>
      </div>

      {/* 4 Top Counters */}
      <div className="grid metrics">
        <div className="metric">
          <div className="metric-top">Open requests</div>
          <strong>6</strong>
          <small>2 need clarification</small>
        </div>
        <div className="metric">
          <div className="metric-top">Quotes ready</div>
          <strong>3</strong>
          <small>1 incomplete offer</small>
        </div>
        <div className="metric">
          <div className="metric-top">Orders at risk</div>
          <strong>2</strong>
          <small>1 delivery change</small>
        </div>
        <div className="metric">
          <div className="metric-top">Awaiting approval</div>
          <strong>1</strong>
          <small>Buyer action required</small>
        </div>
      </div>

      {/* Two Column Section */}
      <div className="grid two-col">
        {/* Recent Procurement Table */}
        <section className="panel">
          <div className="panel-head">
            <h2>Recent procurement</h2>
            <button className="btn btn-quiet" onClick={() => onNavigate('requests')}>
              All requests <span aria-hidden="true">→</span>
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Request / material</th>
                  <th>Quantity · site</th>
                  <th>Required by</th>
                  <th>Status</th>
                  <th>Next step</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.code}>
                    <td>
                      <strong>{r.code}</strong>
                      <span className="sub">{r.spec}</span>
                    </td>
                    <td>
                      <strong>{r.qty.split(' · ')[0]}</strong>
                      <span className="sub">{r.qty.split(' · ')[1]}</span>
                    </td>
                    <td>{r.date}</td>
                    <td>
                      <span className={`pill ${r.statusColor}`}>
                        <span className="dot"></span>
                        {r.status}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: 'var(--muted)' }}>{r.next}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Needs Attention Queue */}
        <section className="panel">
          <div className="panel-head">
            <h2>Needs attention</h2>
            <span className="count count-strong">2</span>
          </div>
          <div className="panel-body">
            <div className="attention-item">
              <div className="attention-icon">
                <svg viewBox="0 0 24 24">
                  <path d="M12 3.5 21 20H3z" />
                  <path d="M12 9v5M12 17.2h.01" />
                </svg>
              </div>
              <div>
                <strong>Supplier shortfall</strong>
                <p>KOV-1028 · 8 of 20 tonnes unconfirmed</p>
                <div className="line-meta">
                  <span>TMT steel · Site A</span>
                  <button className="row-action" onClick={onOpenRecovery}>
                    Review <span aria-hidden="true">→</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="attention-item">
              <div className="attention-icon muted-icon">
                <svg viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="8.5" />
                  <path d="M12 7v5l3 2" />
                </svg>
              </div>
              <div>
                <strong>Delivery date changed</strong>
                <p>KOV-1025 · ETA moved by one day</p>
                <div className="line-meta">
                  <span>PPC cement · Gurugram</span>
                  <button className="row-action" onClick={() => onNavigate('exceptions')}>
                    Review <span aria-hidden="true">→</span>
                  </button>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '14px 0 7px' }}>
              <h3 style={{ fontSize: '11.5px', fontWeight: 650, margin: 0 }}>Next deliveries</h3>
              <button className="btn btn-quiet" onClick={() => onNavigate('orders')}>
                View orders →
              </button>
            </div>
            <div className="kv">
              <span>Sunrise Cement Traders</span>
              <strong>Today, 4:30 PM</strong>
            </div>
            <div className="kv">
              <span>Shakti Steel & Co.</span>
              <strong>Tomorrow, 9:00 AM</strong>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
