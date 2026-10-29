'use client';

import React from 'react';

interface QuotationsViewProps {
  onApproveQuote: (quoteId: string) => void;
  onClarifyQuote: (supplier: string) => void;
}

export function QuotationsView({ onApproveQuote, onClarifyQuote }: QuotationsViewProps) {
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Quotations</h1>
          <p>KOV-1028 · TMT Fe 550D · 12 mm</p>
        </div>
      </div>

      <section className="panel quote-workspace">
        <div className="panel-head quote-context">
          <div>
            <h2>20 tonnes · Site A, Gurugram</h2>
            <p>Required 2 Nov 2026 · 3 supplier responses</p>
          </div>
          <span className="pill amber">
            <span className="dot"></span>2 comparable · 1 incomplete
          </span>
        </div>

        <div className="quote-notice">
          <span className="notice-mark">!</span>
          <span>
            Metro Build Supply has not confirmed freight and unloading. Its delivered total is not comparable.
          </span>
          <button
            className="row-action"
            style={{ marginLeft: 'auto' }}
            onClick={() => onClarifyQuote('Metro Build Supply')}
          >
            Request detail
          </button>
        </div>

        <div className="table-wrap">
          <table className="quote-table">
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Material subtotal</th>
                <th>Freight + unloading</th>
                <th>Delivered total</th>
                <th>Available</th>
                <th>Delivery</th>
                <th>Offer</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {/* Shakti Steel: Current Lead */}
              <tr className="recommended-row">
                <td>
                  <strong>Shakti Steel & Co.</strong>
                  <span className="sub">Preferred supplier · 12 verified orders</span>
                </td>
                <td>₹9,80,000</td>
                <td>₹32,000</td>
                <td>
                  <strong>₹10,12,000</strong>
                  <span className="sub">₹50,600 / tonne</span>
                </td>
                <td>20 tonnes</td>
                <td>
                  1 Nov <span className="sub">Confirmed</span>
                </td>
                <td>
                  <span className="pill green">
                    <span className="dot"></span>Valid 24h
                  </span>
                </td>
                <td>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => onApproveQuote('shakti-steel')}
                  >
                    Review
                  </button>
                </td>
              </tr>

              {/* Northline Metals */}
              <tr>
                <td>
                  <strong>Northline Metals</strong>
                  <span className="sub">4 completed orders</span>
                </td>
                <td>₹9,86,000</td>
                <td>₹32,000</td>
                <td>
                  <strong>₹10,18,000</strong>
                  <span className="sub">₹50,900 / tonne</span>
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
                    onClick={() => onApproveQuote('northline-metals')}
                  >
                    Review
                  </button>
                </td>
              </tr>

              {/* Metro Build Supply */}
              <tr>
                <td>
                  <strong>Metro Build Supply</strong>
                  <span className="sub">New supplier</span>
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
                    onClick={() => onClarifyQuote('Metro Build Supply')}
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
            <span className="decision-label">CURRENT LEAD</span>
            <h3>Shakti Steel & Co.</h3>
            <p>₹6,000 below the next comparable offer, with earlier delivery.</p>
          </div>
          <div className="decision-price">
            <strong>₹10,12,000</strong>
            <span>Delivered total · sample data</span>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => onApproveQuote('shakti-steel')}
          >
            Select for approval
          </button>
        </div>
      </section>
    </div>
  );
}
