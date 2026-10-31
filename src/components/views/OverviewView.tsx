'use client';

import React, { useState, useEffect } from 'react';
import {
  FileText,
  BadgeDollarSign,
  Package,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingUp,
  RefreshCw,
  Plus,
} from 'lucide-react';
import { getProductVisualAsset } from '@/lib/catalogue/product-images';

interface OverviewMetrics {
  openRequests: number;
  verifiedRequests: number;
  clarificationRequests: number;
  awaitingQuotations: number;
  quotationsPendingReview: number;
  approvedQuotations: number;
  activePurchaseOrders: number;
  totalPurchaseOrders: number;
  reconciledDeliveries: number;
  deliveriesInProgress: number;
  openExceptions: number;
  criticalExceptions: number;
  recentRequests: any[];
  recentOrders: any[];
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
  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = () => {
    setLoading(true);
    fetch('/api/procurement/metrics')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load metrics');
        return res.json();
      })
      .then((data) => {
        if (data?.metrics) {
          setMetrics(data.metrics);
        }
      })
      .catch((err) => console.error('Error fetching procurement metrics:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Procurement Overview</h1>
          <p>{workspaceSubtitle} &middot; Live multi-tenant operational intelligence</p>
        </div>
        <div className="head-actions">
          <button className="btn btn-secondary" onClick={fetchMetrics} title="Refresh metrics">
            <RefreshCw size={13} style={{ marginRight: '6px' }} /> Refresh
          </button>
          {onOpenNewRequest && (
            <button className="btn btn-primary" onClick={() => onOpenNewRequest()}>
              <Plus size={14} style={{ marginRight: '4px' }} /> New Request
            </button>
          )}
        </div>
      </div>

      {/* 4 Real Operational Metrics */}
      <div className="grid metrics" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <div
          className="metric"
          style={{ cursor: 'pointer' }}
          onClick={() => onNavigate('requests')}
          title="Click to view all requests"
        >
          <div className="metric-top" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Open requests</span>
            <FileText size={16} className="text-blue-600" />
          </div>
          <strong>{loading ? '...' : metrics?.openRequests ?? 0}</strong>
          <small>
            {metrics?.clarificationRequests ? `${metrics.clarificationRequests} need engineering review` : 'All specifications routed'}
          </small>
        </div>

        <div
          className="metric"
          style={{ cursor: 'pointer' }}
          onClick={() => onNavigate('quotations')}
          title="Click to view quotations matrix"
        >
          <div className="metric-top" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Quotes pending review</span>
            <BadgeDollarSign size={16} className="text-amber-600" />
          </div>
          <strong style={{ color: (metrics?.quotationsPendingReview ?? 0) > 0 ? '#b45309' : 'inherit' }}>
            {loading ? '...' : metrics?.quotationsPendingReview ?? 0}
          </strong>
          <small>Awaiting explicit buyer authorization</small>
        </div>

        <div
          className="metric"
          style={{ cursor: 'pointer' }}
          onClick={() => onNavigate('orders')}
          title="Click to view purchase orders"
        >
          <div className="metric-top" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Active purchase orders</span>
            <Package size={16} className="text-green-600" />
          </div>
          <strong style={{ color: '#15803d' }}>
            {loading ? '...' : metrics?.activePurchaseOrders ?? 0}
          </strong>
          <small>{metrics?.deliveriesInProgress ?? 0} deliveries in progress</small>
        </div>

        <div
          className="metric"
          style={{ cursor: 'pointer' }}
          onClick={() => onNavigate('exceptions')}
          title="Click to review exceptions"
        >
          <div className="metric-top" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Exceptions requiring action</span>
            <AlertTriangle size={16} className="text-red-600" />
          </div>
          <strong style={{ color: (metrics?.openExceptions ?? 0) > 0 ? '#b91c1c' : '#15803d' }}>
            {loading ? '...' : metrics?.openExceptions ?? 0}
          </strong>
          <small>
            {(metrics?.criticalExceptions ?? 0) > 0 ? `${metrics?.criticalExceptions} critical shortfalls` : 'Site receipts on schedule'}
          </small>
        </div>
      </div>

      {/* Two Column Layout: Recent Requests & Active Delivery Status */}
      <div className="grid two-col" style={{ marginTop: '24px', gap: '20px' }}>
        {/* Recent Requisitions */}
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Recent Procurement Requests</h2>
              <p>Active requisitions committed under tenant RLS</p>
            </div>
            <button className="row-action" onClick={() => onNavigate('requests')}>
              View all &rarr;
            </button>
          </div>

          <div className="table-wrap">
            {loading ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>Loading requests...</div>
            ) : !metrics?.recentRequests || metrics.recentRequests.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                No active procurement requests. Click "+ New Request" to create one.
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Specification</th>
                    <th>Destination</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.recentRequests.map((r: any) => {
                    const isVerified = r.requestStatus === 'MATCHED_VERIFIED';
                    return (
                      <tr
                        key={r.id}
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                          if (onOpenRequest) onOpenRequest(r.requestCode);
                          else onNavigate('requests');
                        }}
                      >
                        <td>
                          <strong style={{ color: '#1e40af' }}>{r.requestCode}</strong>
                        </td>
                        <td>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                            {r.materialCategoryId === 'tmt_rebar'
                              ? `TMT Steel ${r.targetGrade ?? ''} · ${r.targetDiameterMm ?? ''}mm`
                              : `Cement ${r.targetGrade ?? ''}`}
                          </div>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>
                            {r.quantityValue} {r.quantityUnit}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontSize: '12px' }}>{r.site?.siteName}</div>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>{r.site?.city}</span>
                        </td>
                        <td>
                          <span className={`pill ${isVerified ? 'green' : 'amber'}`} style={{ fontSize: '10px' }}>
                            <span className="dot"></span>
                            {isVerified ? 'Verified' : 'Clarification'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Active Purchase Orders & Fulfillment */}
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Active Purchase Orders</h2>
              <p>Approved supplier allocations and delivery stages</p>
            </div>
            <button className="row-action" onClick={() => onNavigate('orders')}>
              View all &rarr;
            </button>
          </div>

          <div className="table-wrap">
            {loading ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>Loading orders...</div>
            ) : !metrics?.recentOrders || metrics.recentOrders.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                No active purchase orders. Approving a quotation will generate a PO here.
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>PO Number</th>
                    <th>Supplier</th>
                    <th>Payable</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.recentOrders.map((o: any) => (
                    <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => onNavigate('orders')}>
                      <td>
                        <strong style={{ color: '#1e40af' }}>{o.poNumber}</strong>
                      </td>
                      <td>
                        <div style={{ fontSize: '13px', fontWeight: 600 }}>{o.allocation?.supplierName}</div>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                          {Number(o.allocation?.allocatedQuantity)} tonnes
                        </span>
                      </td>
                      <td>
                        <strong>
                          ₹{Number(o.allocation?.allocatedPayableAmount).toLocaleString('en-IN')}
                        </strong>
                      </td>
                      <td>
                        <span className="pill green" style={{ fontSize: '10px' }}>
                          <span className="dot"></span>
                          {o.poStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
