'use client';

import React, { useState, useEffect } from 'react';
import {
  BadgeDollarSign,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  FileText,
  Clock,
  ArrowRight,
  ShieldCheck,
  Building2,
} from 'lucide-react';

interface QuotationItem {
  id: string;
  quotationReference: string;
  source: string;
  supplier: {
    id: string;
    organizationName: string;
    legalEntityName: string;
    supplierType: string;
    verificationStatus: string;
    headquarters: string;
  };
  request: {
    requestCode: string;
    quantityValue: number;
    quantityUnit: string;
    materialCategoryId: string;
    targetGrade: string | null;
    targetDiameterMm: number | null;
    site: {
      siteName: string;
      city: string;
      pinCode: string;
    };
  };
  spec: string;
  brand: string;
  grade: string;
  quantity: number;
  unit: string;
  baseRate: number;
  baseSubtotal: number;
  gstRate: number;
  gstType: string;
  gstAmount: number;
  freightCharges: number;
  unloadingCharges: number;
  otherCharges: number;
  totalDeliveredAmount: number;
  effectiveRatePerUnit: number;
  leadTimeDays: number | null;
  deliveryEta: string | null;
  paymentTerms: string | null;
  validityDays: number | null;
  validityDate: string | null;
  status: string;
  isComparable: boolean;
  missingTerms: string[] | null;
  reviewNotes: string | null;
  createdAt: string;
}

interface QuotationsViewProps {
  onApproveQuote?: (quoteId: string) => void;
  onClarifyQuote?: (supplier: string) => void;
}

export function QuotationsView({ onApproveQuote, onClarifyQuote }: QuotationsViewProps) {
  const [quotations, setQuotations] = useState<QuotationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuote, setSelectedQuote] = useState<QuotationItem | null>(null);
  const [clarifySupplier, setClarifySupplier] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchQuotations = () => {
    setLoading(true);
    fetch('/api/procurement/quotations')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load quotations');
        return res.json();
      })
      .then((data) => {
        if (data?.quotations) {
          setQuotations(data.quotations);
        }
      })
      .catch((err) => {
        console.error('Error fetching quotations:', err);
        showToast('Error loading commercial quotations');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchQuotations();
  }, []);

  const handleApprove = async (quote: QuotationItem) => {
    setIsApproving(true);
    try {
      const res = await fetch(`/api/procurement/quotations/${quote.id}/approve`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Approval failed');

      showToast(`Quotation approved. Purchase order ${data.purchaseOrder.poNumber} generated.`);
      setSelectedQuote(null);
      fetchQuotations();
      if (onApproveQuote) onApproveQuote(quote.id);
    } catch (err: any) {
      showToast(`Approval failed: ${err.message}`);
    } finally {
      setIsApproving(false);
    }
  };

  const handleSendClarification = async () => {
    if (!clarifySupplier) return;
    const supp = clarifySupplier;
    setClarifySupplier(null);
    showToast(`Clarification request dispatched to ${supp} for missing freight & unloading charges.`);
    if (onClarifyQuote) onClarifyQuote(supp);
  };

  const comparableCount = quotations.filter((q) => q.isComparable).length;
  const incompleteCount = quotations.filter((q) => !q.isComparable).length;

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
          <h1>Commercial Quotations</h1>
          <p>
            {quotations.length} RFQ Responses &middot; Standardized commercial rate comparison matrix
          </p>
        </div>
        <div className="head-actions">
          <button className="btn btn-secondary" onClick={fetchQuotations} title="Refresh quotations list">
            <RefreshCw size={13} style={{ marginRight: '6px' }} /> Refresh Matrix
          </button>
        </div>
      </div>

      <section className="panel quote-workspace">
        <div className="panel-head quote-context">
          <div>
            <h2>
              {quotations[0]?.request
                ? `${quotations[0].request.quantityValue} ${quotations[0].request.quantityUnit} · ${quotations[0].request.site.siteName}`
                : 'Commercial Comparison Matrix'}
            </h2>
            <p>
              Normalized delivered landed cost conforming to BIS statutory standard IS 1786 / IS 269
            </p>
          </div>
          <span className="pill amber">
            <span className="dot"></span>
            {comparableCount} comparable &middot; {incompleteCount} incomplete
          </span>
        </div>

        {/* Incomplete notice if any non-comparable quotes */}
        {incompleteCount > 0 && (
          <div className="quote-notice" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="notice-mark">!</span>
            <span>
              One or more vendor quotes have unconfirmed freight or unloading charges. Landed totals are flagged until missing terms are clarified.
            </span>
          </div>
        )}

        <div className="table-wrap">
          {loading ? (
            <div style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
              Loading commercial quotations...
            </div>
          ) : quotations.length === 0 ? (
            <div style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
              No commercial quotations collected yet. Initiate a supplier call from the Requests tab to populate quotations.
            </div>
          ) : (
            <table className="quote-table">
              <thead>
                <tr>
                  <th>Supplier &amp; Classification</th>
                  <th>Material Subtotal</th>
                  <th>Freight + Unloading</th>
                  <th>Delivered Total</th>
                  <th>Delivery ETA</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {quotations.map((q, idx) => {
                  const isLead = idx === 0 && q.isComparable && q.status !== 'APPROVED';
                  const isApproved = q.status === 'APPROVED';

                  return (
                    <tr
                      key={q.id}
                      className={isLead ? 'recommended-row' : ''}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSelectedQuote(q)}
                    >
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <strong>{q.supplier.organizationName}</strong>
                          {isLead && (
                            <span className="pill green" style={{ fontSize: '9px', padding: '1px 6px' }}>
                              Recommended
                            </span>
                          )}
                          {isApproved && (
                            <span className="pill green" style={{ fontSize: '9px', padding: '1px 6px' }}>
                              Approved PO
                            </span>
                          )}
                        </div>
                        <span className="sub">
                          {q.brand} &middot; {q.grade} &middot; {q.supplier.supplierType.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td>
                        <strong>₹{q.baseSubtotal.toLocaleString('en-IN')}</strong>
                        <span className="sub">
                          ₹{q.baseRate.toLocaleString('en-IN')}/{q.unit} + {q.gstRate}% GST
                        </span>
                      </td>
                      <td>
                        {q.freightCharges > 0 || q.unloadingCharges > 0 ? (
                          <>
                            <strong>₹{(q.freightCharges + q.unloadingCharges).toLocaleString('en-IN')}</strong>
                            <span className="sub">
                              F: ₹{q.freightCharges.toLocaleString('en-IN')} &middot; U: ₹{q.unloadingCharges.toLocaleString('en-IN')}
                            </span>
                          </>
                        ) : (
                          <span style={{ color: '#b45309', fontSize: '11px', fontWeight: 600 }}>
                            Not Confirmed
                          </span>
                        )}
                      </td>
                      <td>
                        <strong style={{ fontSize: '14px', color: q.isComparable ? '#15803d' : '#b45309' }}>
                          ₹{q.totalDeliveredAmount.toLocaleString('en-IN')}
                        </strong>
                        <span className="sub">
                          ₹{Math.round(q.effectiveRatePerUnit).toLocaleString('en-IN')}/{q.unit} delivered
                        </span>
                      </td>
                      <td>
                        <div>{q.deliveryEta || 'Within 2 days'}</div>
                        <span className="sub">{q.paymentTerms || 'Standard Trade Terms'}</span>
                      </td>
                      <td>
                        <span
                          className={`pill ${
                            isApproved ? 'green' : q.isComparable ? 'blue' : 'amber'
                          }`}
                        >
                          <span className="dot"></span>
                          {q.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-primary"
                          style={{ fontSize: '11px', padding: '6px 12px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedQuote(q);
                          }}
                        >
                          Review &amp; Approve &rarr;
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Quote Review Drawer / Modal */}
      {selectedQuote && (
        <div
          className="modal-backdrop"
          onClick={(e) => e.target === e.currentTarget && !isApproving && setSelectedQuote(null)}
        >
          <div className="modal" style={{ maxWidth: '600px' }}>
            <div className="modal-head">
              <div>
                <div className="eyebrow">QUOTATION COMMERCIAL REVIEW</div>
                <h2>{selectedQuote.supplier.organizationName}</h2>
                <p>Reference: {selectedQuote.quotationReference} &middot; Requisition: {selectedQuote.request?.requestCode}</p>
              </div>
              <button
                className="icon-btn"
                onClick={() => !isApproving && setSelectedQuote(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="wizard-main">
              {/* Cost Summary Breakdown */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '16px',
                  marginBottom: '16px',
                }}
              >
                <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: '10px', fontSize: '13px' }}>
                  Commercial Rate Breakdown:
                </div>
                <div className="kv">
                  <span>Base Rate ({selectedQuote.quantity} {selectedQuote.unit})</span>
                  <strong>₹{selectedQuote.baseSubtotal.toLocaleString('en-IN')} (@ ₹{selectedQuote.baseRate}/{selectedQuote.unit})</strong>
                </div>
                <div className="kv">
                  <span>Applicable GST ({selectedQuote.gstRate}%)</span>
                  <strong>₹{selectedQuote.gstAmount.toLocaleString('en-IN')}</strong>
                </div>
                <div className="kv">
                  <span>Freight &amp; Transportation</span>
                  <strong>₹{selectedQuote.freightCharges.toLocaleString('en-IN')}</strong>
                </div>
                <div className="kv">
                  <span>Unloading &amp; Staging Charges</span>
                  <strong>₹{selectedQuote.unloadingCharges.toLocaleString('en-IN')}</strong>
                </div>
                <div
                  className="kv"
                  style={{
                    borderTop: '2px solid #cbd5e1',
                    paddingTop: '8px',
                    marginTop: '8px',
                  }}
                >
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Total Delivered Payable</span>
                  <strong style={{ fontSize: '16px', color: '#15803d' }}>
                    ₹{selectedQuote.totalDeliveredAmount.toLocaleString('en-IN')}
                  </strong>
                </div>
              </div>

              {/* Delivery and Commercial Terms */}
              <div className="panel" style={{ padding: '14px', marginBottom: '16px' }}>
                <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: '8px', fontSize: '12px' }}>
                  Delivery &amp; Payment Terms:
                </div>
                <div className="kv">
                  <span>Delivery Destination</span>
                  <strong>{selectedQuote.request?.site.siteName} ({selectedQuote.request?.site.city})</strong>
                </div>
                <div className="kv">
                  <span>Delivery ETA</span>
                  <strong>{selectedQuote.deliveryEta || 'Immediate dispatch'}</strong>
                </div>
                <div className="kv">
                  <span>Payment Terms</span>
                  <strong>{selectedQuote.paymentTerms || 'Standard Trade Terms'}</strong>
                </div>
                <div className="kv">
                  <span>Quotation Status</span>
                  <span className="pill amber" style={{ fontSize: '10px' }}>
                    {selectedQuote.status.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>

              {selectedQuote.reviewNotes && (
                <div style={{ fontSize: '11.5px', color: '#475569', marginBottom: '16px' }}>
                  <strong>Notes:</strong> {selectedQuote.reviewNotes}
                </div>
              )}
            </div>

            <div className="wizard-footer">
              <button
                className="btn btn-secondary"
                disabled={isApproving}
                onClick={() => setSelectedQuote(null)}
              >
                Cancel
              </button>
              {selectedQuote.status !== 'APPROVED' ? (
                <button
                  className="btn btn-primary"
                  disabled={isApproving}
                  onClick={() => handleApprove(selectedQuote)}
                >
                  {isApproving ? 'Generating Purchase Order...' : 'Approve & Issue PO'}
                </button>
              ) : (
                <span className="pill green" style={{ padding: '6px 14px' }}>
                  Purchase Order Already Issued
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
