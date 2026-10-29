'use client';

import React from 'react';

export function IntegrationsView() {
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Integrations</h1>
          <p>Connected systems and data imports</p>
        </div>
        <div className="head-actions">
          <button className="btn btn-primary">Import data</button>
        </div>
      </div>

      <div className="grid two-col">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Available connections</h2>
              <p>Connection status must reflect a real authentication and sync check.</p>
            </div>
          </div>
          <div className="panel-body">
            <div className="attention-item">
              <div className="attention-icon" style={{ background: '#eaf1ff', color: '#275fc5', fontWeight: 700 }}>
                F
              </div>
              <div style={{ flex: 1 }}>
                <strong>CSV / Excel</strong>
                <p>Import suppliers, items and project requirements using a preview and field mapping.</p>
                <span className="pill blue">
                  <span className="dot"></span>Available in prototype
                </span>
              </div>
              <button className="btn btn-secondary">Configure</button>
            </div>

            <div className="attention-item">
              <div className="attention-icon" style={{ background: '#eff2f6', color: '#4f5e72', fontWeight: 700 }}>
                E
              </div>
              <div style={{ flex: 1 }}>
                <strong>ERPNext</strong>
                <p>First candidate for requests, suppliers and purchase orders.</p>
                <span className="pill gray">
                  <span className="dot"></span>Not connected
                </span>
              </div>
              <button className="btn btn-secondary">Set up</button>
            </div>

            <div className="attention-item">
              <div className="attention-icon" style={{ background: '#eff2f6', color: '#4f5e72', fontWeight: 700 }}>
                T
              </div>
              <div style={{ flex: 1 }}>
                <strong>TallyPrime</strong>
                <p>Consider after target-customer demand and integration approach are confirmed.</p>
                <span className="pill gray">
                  <span className="dot"></span>Planned
                </span>
              </div>
              <button className="btn btn-secondary">Details</button>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>System of record</h2>
          </div>
          <div className="panel-body">
            <div className="kv">
              <span>Supplier master</span>
              <strong>Connected ERP / user import</strong>
            </div>
            <div className="kv">
              <span>Product catalog</span>
              <strong>Kovok canonical ID + source data</strong>
            </div>
            <div className="kv">
              <span>Quotes & call evidence</span>
              <strong>Kovok</strong>
            </div>
            <div className="kv">
              <span>Approved order / PO</span>
              <strong>Existing system when connected</strong>
            </div>
            <div className="kv">
              <span>Payment and ledger</span>
              <strong>Buyer accounting system</strong>
            </div>
            <div className="alert" style={{ marginTop: '14px' }}>
              Never silently overwrite connected records. Conflicts should appear in a review queue.
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
