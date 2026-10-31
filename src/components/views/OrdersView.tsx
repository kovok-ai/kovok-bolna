'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  Package,
  FileDown,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  Plus,
  Building2,
  FileText,
  ShieldCheck,
} from 'lucide-react';

interface OrderItem {
  id: string;
  poNumber: string;
  poStatus: string;
  createdAt: string;
  consistencyChecksum: string;
  supplierName: string;
  quotationReference: string;
  specification: string;
  brand: string;
  grade: string;
  totalQuantity: number;
  quantityUnit: string;
  deliveredQuantity: number;
  pendingQuantity: number;
  totalPayableAmount: number;
  siteName: string;
  siteCity: string;
  sitePinCode: string;
  paymentTerms: string;
  deliveryEta: string;
  latestMilestone: string;
  nextMilestone: string;
  milestonesCount: number;
  milestones: any[];
}

interface OrdersViewProps {
  onExport?: () => void;
  onOpenOrder?: (orderId: string) => void;
}

export function OrdersView({ onExport, onOpenOrder }: OrdersViewProps) {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [selectedOrder, setSelectedOrder] = useState<OrderItem | null>(null);
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [recordQty, setRecordQty] = useState('');
  const [recordNotes, setRecordNotes] = useState('');
  const [recordCode, setRecordCode] = useState('MS-GATE-ENTRY');
  const [isRecording, setIsRecording] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchOrders = () => {
    setLoading(true);
    fetch('/api/procurement/orders')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load orders');
        return res.json();
      })
      .then((data) => {
        if (data?.orders) {
          setOrders(data.orders);
        }
      })
      .catch((err) => {
        console.error('Error fetching orders:', err);
        showToast('Error loading purchase orders');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleRecordMilestone = async () => {
    if (!selectedOrder) return;
    setIsRecording(true);
    try {
      const res = await fetch(`/api/procurement/orders/${selectedOrder.id}/milestones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          milestoneCode: recordCode,
          milestoneTitle:
            recordCode === 'MS-GATE-ENTRY'
              ? 'Site Gate Entry & Security Stamp'
              : recordCode === 'MS-WEIGHBRIDGE'
              ? 'Weighbridge Gross & Tare Measurement'
              : recordCode === 'MS-INSPECTION'
              ? 'Mill Test Certificate (MTC) & Quality Inspection'
              : 'Material Offloaded & Stock Reconciled',
          milestoneStatus: 'ACHIEVED',
          quantityDelivered: recordQty ? parseFloat(recordQty) : undefined,
          notes: recordNotes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record milestone');

      showToast(`Milestone recorded for ${selectedOrder.poNumber}.`);
      setIsRecordModalOpen(false);
      setRecordQty('');
      setRecordNotes('');
      fetchOrders();
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    } finally {
      setIsRecording(false);
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (filter === 'ALL') return true;
    return o.poStatus === filter;
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
          <h1>Orders &amp; Site Delivery</h1>
          <p>
            {orders.length} Purchase orders issued &middot; Delivery milestone verification and site weighbridge records
          </p>
        </div>
        <div className="head-actions">
          <button className="btn btn-secondary" onClick={fetchOrders} title="Refresh orders">
            <RefreshCw size={13} style={{ marginRight: '6px' }} /> Refresh
          </button>
          <a
            href={orders.length > 0 ? `/api/procurement/orders/${orders[0].id}/export` : '#'}
            className="btn btn-secondary"
            onClick={(e) => {
              if (orders.length === 0) {
                e.preventDefault();
                showToast('No orders available to export.');
              } else {
                showToast('Exporting purchase orders record...');
              }
            }}
          >
            <FileDown size={14} style={{ marginRight: '4px' }} /> Export Orders
          </a>
        </div>
      </div>

      {/* Orders Table Panel */}
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Active Purchase Orders ({filteredOrders.length})</h2>
            <p>Database-backed contracts with immutable consistency checksums</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select
              className="filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              aria-label="Filter orders by status"
            >
              <option value="ALL">All statuses ({orders.length})</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="DISPATCHED">Dispatched</option>
              <option value="ARRIVED">Arrived</option>
              <option value="RECONCILED">Reconciled</option>
            </select>
          </div>
        </div>

        <div className="table-wrap">
          {loading ? (
            <div style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
              Loading purchase orders...
            </div>
          ) : orders.length === 0 ? (
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
                No purchase orders created yet
              </strong>
              <p style={{ maxWidth: '420px', margin: '0 auto', fontSize: '12px' }}>
                Approving a quotation in the Quotations view will generate a verified purchase order here.
              </p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>PO Number</th>
                  <th>Material &amp; Specification</th>
                  <th>Quantity &middot; Destination</th>
                  <th>Payable Amount</th>
                  <th>Current Milestone</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((o) => (
                  <tr
                    key={o.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      setSelectedOrder(o);
                      if (onOpenOrder) onOpenOrder(o.id);
                    }}
                  >
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <strong style={{ color: '#1e40af' }}>{o.poNumber}</strong>
                        {o.poNumber === 'PO-0261' && (
                          <span
                            className="pill"
                            title="Illustrative evaluation order · Not supplier-confirmed"
                            style={{
                              fontSize: '9px',
                              padding: '1px 6px',
                              background: '#f8fafc',
                              color: '#64748b',
                              border: '1px solid #cbd5e1',
                            }}
                          >
                            Evaluation
                          </span>
                        )}
                      </div>
                      <span className="sub">
                        {new Date(o.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </td>
                    <td>
                      <strong>{o.specification}</strong>
                      <span className="sub">{o.supplierName} &middot; {o.brand}</span>
                    </td>
                    <td>
                      <strong>
                        {o.totalQuantity} {o.quantityUnit}
                      </strong>
                      <span className="sub">{o.siteName} ({o.siteCity})</span>
                    </td>
                    <td>
                      <strong>₹{o.totalPayableAmount.toLocaleString('en-IN')}</strong>
                      <span className="sub">{o.paymentTerms}</span>
                    </td>
                    <td>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                        {o.latestMilestone}
                      </div>
                      <span className="sub" style={{ color: '#b45309' }}>
                        Next: {o.nextMilestone}
                      </span>
                    </td>
                    <td>
                      <span className="pill green" style={{ fontSize: '10px' }}>
                        <span className="dot"></span>
                        {o.poStatus}
                      </span>
                    </td>
                    <td>
                      <button
                        className="row-action"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedOrder(o);
                          if (onOpenOrder) onOpenOrder(o.id);
                        }}
                      >
                        Delivery Details &rarr;
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Order & Milestones Detail Drawer */}
      {selectedOrder && (
        <div
          className="modal-backdrop"
          onClick={(e) => e.target === e.currentTarget && setSelectedOrder(null)}
        >
          <div className="modal" style={{ maxWidth: '640px' }}>
            <div className="modal-head">
              <div>
                <div className="eyebrow">PURCHASE ORDER &amp; FULFILLMENT</div>
                <h2>{selectedOrder.poNumber} &middot; {selectedOrder.supplierName}</h2>
                <p>Status: {selectedOrder.poStatus} &middot; Destination: {selectedOrder.siteName}</p>
              </div>
              <button className="icon-btn" onClick={() => setSelectedOrder(null)}>
                <X size={16} />
              </button>
            </div>

            <div className="wizard-main">
              {/* Order Metadata Panel */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '14px',
                  marginBottom: '16px',
                }}
              >
                <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: '8px', fontSize: '12.5px' }}>
                  Contract Terms &amp; Consistency Checksum:
                </div>
                <div className="kv">
                  <span>Material Specification</span>
                  <strong>{selectedOrder.specification}</strong>
                </div>
                <div className="kv">
                  <span>Approved Quantity</span>
                  <strong>{selectedOrder.totalQuantity} {selectedOrder.quantityUnit}</strong>
                </div>
                <div className="kv">
                  <span>Total Delivered Payable</span>
                  <strong style={{ color: '#15803d' }}>₹{selectedOrder.totalPayableAmount.toLocaleString('en-IN')}</strong>
                </div>
                <div className="kv">
                  <span>Delivery Address</span>
                  <span>{selectedOrder.siteName}, {selectedOrder.siteCity} - {selectedOrder.sitePinCode}</span>
                </div>
                <div className="kv">
                  <span>SHA-256 Checksum</span>
                  <code style={{ fontSize: '10px' }}>{selectedOrder.consistencyChecksum.slice(0, 24)}...</code>
                </div>
              </div>

              {/* Delivery Milestones Tracker */}
              <div className="panel" style={{ padding: '14px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <strong style={{ fontSize: '13px', color: '#1e293b' }}>Auditable Delivery Milestones</strong>
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: '11px', padding: '4px 10px' }}
                    onClick={() => setIsRecordModalOpen(true)}
                  >
                    + Record Milestone
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedOrder.milestones.map((m: any) => {
                    const isDone = m.milestoneStatus === 'ACHIEVED';
                    return (
                      <div
                        key={m.id}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          background: isDone ? '#f0fdf4' : '#f8fafc',
                          border: `1px solid ${isDone ? '#bbf7d0' : '#e2e8f0'}`,
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {isDone ? (
                              <CheckCircle2 size={14} className="text-green-600" />
                            ) : (
                              <Clock size={14} className="text-gray-400" />
                            )}
                            <strong style={{ fontSize: '12px', color: isDone ? '#15803d' : '#475569' }}>
                              {m.milestoneTitle}
                            </strong>
                          </div>
                          {m.notes && (
                            <span style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', display: 'block' }}>
                              {m.notes}
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>
                          {m.actualDate ? new Date(m.actualDate).toLocaleDateString('en-IN') : 'Pending'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="wizard-footer">
              <a
                href={`/api/procurement/orders/${selectedOrder.id}/export`}
                className="btn btn-secondary"
                style={{ fontSize: '12px' }}
              >
                <FileDown size={14} style={{ marginRight: '4px' }} /> Download CSV Record
              </a>
              <button className="btn btn-primary" onClick={() => setSelectedOrder(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Milestone Modal */}
      {isRecordModalOpen && selectedOrder && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && !isRecording && setIsRecordModalOpen(false)}>
          <div className="modal" style={{ maxWidth: '500px' }}>
            <div className="modal-head">
              <div>
                <div className="eyebrow">SITE RECEIPT VERIFICATION</div>
                <h2>Record Delivery Milestone</h2>
                <p>{selectedOrder.poNumber} &middot; {selectedOrder.supplierName}</p>
              </div>
              <button className="icon-btn" onClick={() => !isRecording && setIsRecordModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="wizard-main">
              <div className="field" style={{ marginBottom: '14px' }}>
                <label>Milestone Stage</label>
                <select
                  value={recordCode}
                  onChange={(e) => setRecordCode(e.target.value)}
                  disabled={isRecording}
                  aria-label="Milestone Stage"
                >
                  <option value="MS-GATE-ENTRY">Site Gate Entry &amp; Security Stamp</option>
                  <option value="MS-WEIGHBRIDGE">Weighbridge Gross &amp; Tare Measurement</option>
                  <option value="MS-INSPECTION">Mill Test Certificate (MTC) &amp; Quality Inspection</option>
                  <option value="MS-OFFLOADED">Material Offloaded &amp; Stock Reconciled</option>
                </select>
              </div>

              <div className="field" style={{ marginBottom: '14px' }}>
                <label>Quantity Delivered ({selectedOrder.quantityUnit})</label>
                <input
                  type="number"
                  placeholder={`e.g. ${selectedOrder.totalQuantity}`}
                  value={recordQty}
                  onChange={(e) => setRecordQty(e.target.value)}
                  disabled={isRecording}
                />
              </div>

              <div className="field" style={{ marginBottom: '14px' }}>
                <label>Audit &amp; Inspection Notes (Slip #, Heat Number, Observations)</label>
                <textarea
                  placeholder="e.g. Weighbridge slip WB-8891 recorded gross weight 32.4 MT, tare 12.4 MT. Net 20 MT verified conforming."
                  value={recordNotes}
                  onChange={(e) => setRecordNotes(e.target.value)}
                  disabled={isRecording}
                  rows={3}
                />
              </div>
            </div>

            <div className="wizard-footer">
              <button
                className="btn btn-secondary"
                disabled={isRecording}
                onClick={() => setIsRecordModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                disabled={isRecording}
                onClick={handleRecordMilestone}
              >
                {isRecording ? 'Recording...' : 'Commit Milestone'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
