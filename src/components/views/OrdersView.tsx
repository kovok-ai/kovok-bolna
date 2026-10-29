'use client';

import React, { useState } from 'react';

interface OrdersViewProps {
  onExport?: () => void;
  onOpenOrder?: (orderId: string) => void;
}

export function OrdersView({ onExport, onOpenOrder }: OrdersViewProps) {
  const [filter, setFilter] = useState('All active orders');

  const orders = [
    { po: 'PO-0261', spec: 'TMT steel · Fe 550D · 12 mm', qty: '20 tonnes', supplier: 'Shakti Steel & Co.', eta: 'Tomorrow, 9:00 AM', status: 'Confirmed', statusColor: 'green', next: 'Receipt pending' },
    { po: 'PO-0260', spec: 'PPC cement · 50 kg', qty: '500 bags', supplier: 'Sunrise Cement Traders', eta: 'Today, 4:30 PM', status: 'Dispatch confirmed', statusColor: 'blue', next: 'Tracking received' },
    { po: 'PO-0259', spec: 'TMT steel · Fe 500D · 16 mm', qty: '8 tonnes', supplier: 'Northline Metals', eta: 'Oct 31 · 1 day risk', status: 'At risk', statusColor: 'red', next: 'Recovery open' },
  ];

  const filtered = orders.filter((o) => {
    if (filter === 'All active orders') return true;
    if (filter === 'At risk') return o.status === 'At risk';
    if (filter === 'Awaiting receipt') return o.next.includes('Receipt');
    return true;
  });

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Orders & delivery</h1>
          <p>{orders.length} active orders</p>
        </div>
        <div className="head-actions">
          <button className="btn btn-secondary" onClick={onExport}>
            Export
          </button>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Active orders</h2>
            <p>Every order retains the approved quotation and its exact terms.</p>
          </div>
          <select
            className="filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Filter active orders"
          >
            <option>All active orders</option>
            <option>At risk</option>
            <option>Awaiting receipt</option>
          </select>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Material / spec</th>
                <th>Quantity</th>
                <th>Supplier</th>
                <th>Promised ETA</th>
                <th>Status</th>
                <th>Next step</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.po}>
                  <td>
                    <strong>{o.po}</strong>
                  </td>
                  <td>
                    <strong>{o.spec}</strong>
                    <span className="sub">Approved specification</span>
                  </td>
                  <td>{o.qty}</td>
                  <td>{o.supplier}</td>
                  <td>{o.eta}</td>
                  <td>
                    <span className={`pill ${o.statusColor}`}>
                      <span className="dot"></span>
                      {o.status}
                    </span>
                  </td>
                  <td>
                    <span style={{ color: 'var(--muted)' }}>{o.next}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="panel-body">
          <div className="alert">
            A supplier&apos;s dispatch message does not close an order. Record actual received quantity and inspection outcome separately. Payment terms remain direct buyer-to-supplier.
          </div>
        </div>
      </section>
    </div>
  );
}
