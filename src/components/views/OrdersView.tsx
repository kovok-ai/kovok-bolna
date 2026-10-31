'use client';

import React, { useState } from 'react';

interface OrdersViewProps {
  onExport?: () => void;
  onOpenOrder?: (orderId: string) => void;
}

export function OrdersView({ onExport, onOpenOrder }: OrdersViewProps) {
  const [filter, setFilter] = useState('All active orders');
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const orders = [
    {
      po: 'PO-0261',
      spec: 'TMT Steel Fe 550D · 12 mm',
      std: 'IS 1786:2008 Grade Fe 550D',
      qty: '20 tonnes (1,877 bars)',
      supplier: 'Shakti Steel & Co.',
      supplierId: 'SUP-JSW-ONE',
      site: 'Site A — Gurugram',
      pin: '122001',
      payable: '₹10,12,000',
      eta: 'Tomorrow, 9:00 AM',
      status: 'Confirmed',
      statusColor: 'green',
      next: 'Site receipt pending',
      mtcStatus: 'Mill Test Certificate Verified',
      transporter: 'Delhi-NCR Logistics Fleet (Trailer HR-55-AB-1234)',
    },
    {
      po: 'PO-0260',
      spec: 'PPC Cement · 50 kg Bag',
      std: 'IS 1489 (Part 1):2015',
      qty: '500 bags (25 MT)',
      supplier: 'Sunrise Cement Traders',
      supplierId: 'SUP-ULTRATECH-DEALER-MUMBAI',
      site: 'Dwarka Commercial Project',
      pin: '110075',
      payable: '₹1,85,000',
      eta: 'Today, 4:30 PM',
      status: 'Dispatch confirmed',
      statusColor: 'blue',
      next: 'Tracking received',
      mtcStatus: 'Batch Test Report Verified',
      transporter: 'Apex Transport (Truck DL-1L-AA-5678)',
    },
    {
      po: 'PO-0259',
      spec: 'TMT Steel Fe 500D · 16 mm',
      std: 'IS 1786:2008 Grade Fe 500D',
      qty: '8 tonnes (422 bars)',
      supplier: 'Northline Metals',
      supplierId: 'SUP-TATA-DEALER-NCR',
      site: 'Site A — Gurugram',
      pin: '122001',
      payable: '₹4,12,000',
      eta: 'Oct 31 · 1 day risk',
      status: 'At risk',
      statusColor: 'red',
      next: 'Recovery open',
      mtcStatus: 'Pending Mill Dispatch',
      transporter: 'Rolling Shortfall Reported by Supplier',
    },
  ];

  const filtered = orders.filter((o) => {
    if (filter === 'All active orders') return true;
    if (filter === 'At risk') return o.status === 'At risk';
    if (filter === 'Awaiting receipt') return o.next.includes('receipt') || o.next.includes('Receipt');
    return true;
  });

  const handleExportCSV = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [
        'PO Number,Specification,Standard,Quantity,Supplier,Site,Payable,ETA,Status',
        ...orders.map(
          (o) =>
            `"${o.po}","${o.spec}","${o.std}","${o.qty}","${o.supplier}","${o.site}","${o.payable}","${o.eta}","${o.status}"`
        ),
      ].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `kovok_orders_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exported purchase orders to CSV.');
    if (onExport) onExport();
  };

  return (
    <div>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="toast" style={{ top: '24px', zIndex: 1100 }}>
          {toastMessage}
        </div>
      )}

      {/* Page Header */}
      <div className="page-head">
        <div>
          <h1>Orders &amp; Site Deliveries</h1>
          <p>{orders.length} active purchase orders tracked against approved quotation terms</p>
        </div>
        <div className="head-actions">
          <button className="btn btn-secondary" onClick={handleExportCSV}>
            Export Orders CSV
          </button>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Active Purchase Orders</h2>
            <p>Immutable terms snapshot preserved with SHA-256 consistency verification</p>
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
                <th>Order Number</th>
                <th>Material &amp; Specification</th>
                <th>Quantity</th>
                <th>Supplier</th>
                <th>Promised ETA</th>
                <th>Status</th>
                <th>Next Step</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr
                  key={o.po}
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    setSelectedOrder(o);
                    if (onOpenOrder) onOpenOrder(o.po);
                  }}
                >
                  <td>
                    <strong style={{ color: '#1e40af' }}>{o.po}</strong>
                  </td>
                  <td>
                    <strong>{o.spec}</strong>
                    <span className="sub">{o.std}</span>
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
                    <span style={{ color: 'var(--muted)', fontSize: '11.5px' }}>{o.next}</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="row-action"
                      style={{ color: '#1e40af', fontWeight: 600 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedOrder(o);
                        if (onOpenOrder) onOpenOrder(o.po);
                      }}
                    >
                      Track →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Order Tracking & Inspection Drawer */}
      {selectedOrder && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setSelectedOrder(null)}>
          <div className="modal" style={{ maxWidth: '620px' }}>
            <div className="modal-head">
              <div>
                <div className="eyebrow">PURCHASE ORDER MILESTONES · {selectedOrder.po}</div>
                <h2>{selectedOrder.spec}</h2>
                <p>Supplier: {selectedOrder.supplier} · Destination: {selectedOrder.site}</p>
              </div>
              <button className="icon-btn" onClick={() => setSelectedOrder(null)}>×</button>
            </div>
            <div style={{ padding: '16px' }}>
              <div className="panel" style={{ padding: '14px', marginBottom: '16px' }}>
                <div className="kv">
                  <span>Payable Amount (Delivered)</span>
                  <strong style={{ fontSize: '15px', color: '#15803d' }}>{selectedOrder.payable}</strong>
                </div>
                <div className="kv">
                  <span>Ordered Quantity</span>
                  <strong>{selectedOrder.qty}</strong>
                </div>
                <div className="kv">
                  <span>Statutory Standard</span>
                  <span>{selectedOrder.std}</span>
                </div>
                <div className="kv">
                  <span>Test Certificate (MTC)</span>
                  <span className="pill green">{selectedOrder.mtcStatus}</span>
                </div>
                <div className="kv">
                  <span>Assigned Logistics / Fleet</span>
                  <span>{selectedOrder.transporter}</span>
                </div>
                <div className="kv">
                  <span>Estimated Arrival</span>
                  <strong>{selectedOrder.eta}</strong>
                </div>
              </div>

              {/* Delivery Milestone Progress Bar */}
              <div style={{ marginBottom: '16px' }}>
                <strong style={{ display: 'block', fontSize: '12px', color: '#0f172a', marginBottom: '8px' }}>
                  Site Delivery Milestones:
                </strong>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', textAlign: 'center' }}>
                  <div style={{ background: '#dcfce7', border: '1px solid #86efac', padding: '8px 4px', borderRadius: '6px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#15803d' }}>1. CONFIRMED</span>
                    <span style={{ display: 'block', fontSize: '9px', color: '#166534' }}>Done</span>
                  </div>
                  <div style={{ background: '#dcfce7', border: '1px solid #86efac', padding: '8px 4px', borderRadius: '6px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#15803d' }}>2. LOADED</span>
                    <span style={{ display: 'block', fontSize: '9px', color: '#166534' }}>Mill Dispatched</span>
                  </div>
                  <div style={{ background: selectedOrder.status === 'At risk' ? '#fee2e2' : '#e0f2fe', border: `1px solid ${selectedOrder.status === 'At risk' ? '#fca5a5' : '#7dd3fc'}`, padding: '8px 4px', borderRadius: '6px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: selectedOrder.status === 'At risk' ? '#991b1b' : '#0369a1' }}>
                      3. IN TRANSIT
                    </span>
                    <span style={{ display: 'block', fontSize: '9px', color: '#475569' }}>
                      {selectedOrder.status === 'At risk' ? 'Delayed' : 'En Route'}
                    </span>
                  </div>
                  <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: '8px 4px', borderRadius: '6px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b' }}>4. UNLOADED</span>
                    <span style={{ display: 'block', fontSize: '9px', color: '#94a3b8' }}>Site Inspection</span>
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.45 }}>
                Payment release is conditioned upon physical weighbridge slip match and mill test certificate verification by the site engineer.
              </div>
            </div>
            <div className="wizard-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedOrder(null)}>Close</button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setSelectedOrder(null);
                  showToast(`Site delivery note downloaded for ${selectedOrder.po}.`);
                }}
              >
                Download Delivery Note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
