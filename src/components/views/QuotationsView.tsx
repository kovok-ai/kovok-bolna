'use client';

import React, { useState } from 'react';

interface QuotationsViewProps {
  onApproveQuote?: (quoteId: string) => void;
  onClarifyQuote?: (supplier: string) => void;
}

export function QuotationsView({ onApproveQuote, onClarifyQuote }: QuotationsViewProps) {
  const [activeQuoteId, setActiveQuoteId] = useState<string | null>(null);
  const [clarifySupplier, setClarifySupplier] = useState<string | null>(null);
  const [clarificationSent, setClarificationSent] = useState(false);
  const [approvalConfirmed, setApprovalConfirmed] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleApprove = (supplierName: string, amount: string) => {
    setApprovalConfirmed(true);
    setActiveQuoteId(null);
    showToast(`Quotation approved for ${supplierName} (${amount}). Purchase order generated.`);
    if (onApproveQuote) onApproveQuote(supplierName);
  };

  const handleSendClarification = () => {
    setClarificationSent(true);
    const supp = clarifySupplier;
    setClarifySupplier(null);
    showToast(`Clarification request dispatched to ${supp} for missing freight & unloading charges.`);
    if (onClarifyQuote && supp) onClarifyQuote(supp);
  };

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
          <p>RFQ Responses for KOV-REQ-0001 · TMT Steel Fe 500D · 12 mm</p>
        </div>
        <div className="head-actions">
          <span className="pill green" style={{ padding: '6px 12px' }}>
            <span className="dot"></span>Live Comparison Matrix
          </span>
        </div>
      </div>

      <section className="panel quote-workspace">
        <div className="panel-head quote-context">
          <div>
            <h2>20 tonnes · Site A, Gurugram (PIN 122001)</h2>
            <p>Required by 2 Nov 2026 · Standard 12m length conforming to IS 1786:2008</p>
          </div>
          <span className="pill amber">
            <span className="dot"></span>2 comparable · 1 incomplete
          </span>
        </div>

        {/* Notice for Incomplete Terms */}
        <div className="quote-notice">
          <span className="notice-mark">!</span>
          <span>
            Metro Build Supply has not confirmed freight and unloading. Its delivered total is not comparable under statutory procurement rules.
          </span>
          <button
            className="row-action"
            style={{ marginLeft: 'auto' }}
            onClick={() => setClarifySupplier('Metro Build Supply')}
          >
            Request detail →
          </button>
        </div>

        <div className="table-wrap">
          <table className="quote-table">
            <thead>
              <tr>
                <th>Supplier &amp; Classification</th>
                <th>Material Subtotal</th>
                <th>Freight + Unloading</th>
                <th>Delivered Total</th>
                <th>Available</th>
                <th>Delivery ETA</th>
                <th>Offer Validity</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {/* Shakti Steel: Current Lead */}
              <tr className="recommended-row">
                <td>
                  <strong>Shakti Steel &amp; Co.</strong>
                  <span className="sub">Tata Tiscon &amp; JSW Authorized · 12 verified orders</span>
                </td>
                <td>₹9,80,000</td>
                <td>₹32,000</td>
                <td>
                  <strong>₹10,12,000</strong>
                  <span className="sub">₹50,600 / tonne (incl. GST 18%)</span>
                </td>
                <td>20 tonnes</td>
                <td>
                  Tomorrow <span className="sub">Confirmed 9:00 AM</span>
                </td>
                <td>
                  <span className="pill green">
                    <span className="dot"></span>Valid 24h
                  </span>
                </td>
                <td>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => setActiveQuoteId('shakti')}
                  >
                    Review &amp; Select
                  </button>
                </td>
              </tr>

              {/* Northline Metals */}
              <tr>
                <td>
                  <strong>Northline Metals</strong>
                  <span className="sub">Jindal Panther Authorized Stockist · 4 completed orders</span>
                </td>
                <td>₹9,86,000</td>
                <td>₹32,000</td>
                <td>
                  <strong>₹10,18,000</strong>
                  <span className="sub">₹50,900 / tonne (incl. GST 18%)</span>
                </td>
                <td>20 tonnes</td>
                <td>
                  2 Nov <span className="sub">Confirmed</span>
                </td>
                <td>
                  <span className="pill blue">
                    <span className="dot"></span>Valid 12h
                  </span>
                </td>
                <td>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setActiveQuoteId('northline')}
                  >
                    Review
                  </button>
                </td>
              </tr>

              {/* Metro Build Supply */}
              <tr>
                <td>
                  <strong>Metro Build Supply</strong>
                  <span className="sub">Candidate Supplier · Faridabad</span>
                </td>
                <td>₹9,96,000</td>
                <td>
                  <span style={{ color: 'var(--muted)' }}>Not confirmed</span>
                </td>
                <td>
                  <strong>—</strong>
                  <span className="sub">Delivered total pending</span>
                </td>
                <td>
                  20 tonnes <span className="sub">Claimed</span>
                </td>
                <td>
                  1 Nov <span className="sub">Estimated</span>
                </td>
                <td>
                  <span className="pill amber">
                    <span className="dot"></span>Incomplete
                  </span>
                </td>
                <td>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setClarifySupplier('Metro Build Supply')}
                  >
                    Clarify
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Commercial Decision Lead Summary */}
        <div className="quote-decision">
          <div>
            <span className="decision-label">RECOMMENDED COMMERCIAL LEAD</span>
            <h3>Shakti Steel &amp; Co.</h3>
            <p>₹6,000 below the next comparable offer, with guaranteed test certificate and earlier site delivery.</p>
          </div>
          <div className="decision-price">
            <strong>₹10,12,000</strong>
            <span>Delivered total (All-inclusive)</span>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => setActiveQuoteId('shakti')}
          >
            Select for Buyer Approval →
          </button>
        </div>
      </section>

      {/* Review & Approval Modal */}
      {activeQuoteId && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setActiveQuoteId(null)}>
          <div className="modal" style={{ maxWidth: '580px' }}>
            <div className="modal-head">
              <div>
                <div className="eyebrow">BUYER COMMERCIAL APPROVAL</div>
                <h2>
                  Approve Quotation · {activeQuoteId === 'shakti' ? 'Shakti Steel & Co.' : 'Northline Metals'}
                </h2>
                <p>Request Reference: KOV-REQ-0001 · 20 MT TMT Steel Fe 500D 12mm</p>
              </div>
              <button className="icon-btn" onClick={() => setActiveQuoteId(null)}>×</button>
            </div>
            <div style={{ padding: '16px' }}>
              <div className="panel" style={{ padding: '14px', marginBottom: '14px' }}>
                <div className="kv">
                  <span>Base Material (20 MT)</span>
                  <strong>{activeQuoteId === 'shakti' ? '₹8,30,508' : '₹8,35,593'}</strong>
                </div>
                <div className="kv">
                  <span>Applicable GST (18%)</span>
                  <span>{activeQuoteId === 'shakti' ? '₹1,49,492' : '₹1,50,407'}</span>
                </div>
                <div className="kv">
                  <span>Dedicated Trailer Freight</span>
                  <span>₹28,000</span>
                </div>
                <div className="kv">
                  <span>Site Crane Unloading</span>
                  <span>₹4,000</span>
                </div>
                <div className="kv" style={{ borderTop: '2px solid #e2e8f0', paddingTop: '8px', marginTop: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>Total Delivered Payable</span>
                  <strong style={{ fontSize: '16px', color: '#15803d' }}>
                    {activeQuoteId === 'shakti' ? '₹10,12,000' : '₹10,18,000'}
                  </strong>
                </div>
              </div>

              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '12px',
                  fontSize: '11px',
                  color: '#475569',
                  lineHeight: 1.45,
                }}
              >
                <strong>Statutory Invariant Enforcement:</strong> Approval generates a cryptographically signed approval record and commits the allocated quantity to prevent over-allocation under database triggers.
              </div>
            </div>
            <div className="wizard-footer">
              <button className="btn btn-secondary" onClick={() => setActiveQuoteId(null)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={() =>
                  handleApprove(
                    activeQuoteId === 'shakti' ? 'Shakti Steel & Co.' : 'Northline Metals',
                    activeQuoteId === 'shakti' ? '₹10,12,000' : '₹10,18,000'
                  )
                }
              >
                Confirm Buyer Approval
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Supplier Clarification Modal */}
      {clarifySupplier && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setClarifySupplier(null)}>
          <div className="modal" style={{ maxWidth: '480px' }}>
            <div className="modal-head">
              <div>
                <div className="eyebrow">TERMS RECONCILIATION</div>
                <h2>Request Missing Quotation Terms</h2>
                <p>Vendor: {clarifySupplier}</p>
              </div>
              <button className="icon-btn" onClick={() => setClarifySupplier(null)}>×</button>
            </div>
            <div style={{ padding: '16px' }}>
              <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>
                {clarifySupplier} provided a basic material price of ₹9,96,000 but did not specify:
              </p>
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '10px', fontSize: '11.5px', color: '#991b1b', marginBottom: '14px' }}>
                • Destination freight charge to Site A, Gurugram (PIN 122001)<br />
                • Crane or manual site unloading terms<br />
                • Mill manufacturer test certificate availability
              </div>
              <div className="field">
                <label>Clarification Note to Dispatch Team</label>
                <textarea
                  rows={3}
                  defaultValue="Please provide destination delivered freight rate and confirmation of IS 1786 test certificate for 20 MT Fe 500D 12mm rebar."
                />
              </div>
            </div>
            <div className="wizard-footer">
              <button className="btn btn-secondary" onClick={() => setClarifySupplier(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSendClarification}>
                Send Clarification Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
