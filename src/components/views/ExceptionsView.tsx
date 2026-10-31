'use client';

import React, { useState } from 'react';

interface ExceptionsViewProps {
  onReviewRecovery?: (code: string) => void;
}

export function ExceptionsView({ onReviewRecovery }: ExceptionsViewProps) {
  const [filter, setFilter] = useState('All open');
  const [selectedException, setSelectedException] = useState<any | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const [exceptions, setExceptions] = useState([
    {
      code: 'EX-008',
      type: 'Supplier shortfall',
      related: 'PO-0259 · TMT Steel Fe 500D 16mm',
      impact: '8 tonnes not confirmed by Northline Metals due to rolling cycle shift',
      next: 'Alternative vendor sourcing',
      state: 'Open',
      color: 'amber',
      options: ['Contact Shakti Steel & Co. for immediate 8 MT dispatch', 'Split order: Take 4 MT now, 4 MT from next rolling cycle', 'Cancel shortfall and close PO'],
    },
    {
      code: 'EX-007',
      type: 'ETA changed',
      related: 'PO-0260 · Cement PPC 50kg',
      impact: 'Trailer transport breakdown moved delivery by 4 hours to 8:30 PM',
      next: 'Site night unloading clearance',
      state: 'Open',
      color: 'amber',
      options: ['Authorize night unloading with site lighting clearance', 'Reschedule delivery to tomorrow 7:00 AM', 'Re-route truck to Dwarka staging yard'],
    },
    {
      code: 'EX-006',
      type: 'Incomplete quote',
      related: 'KOV-REQ-0001 · TMT Steel',
      impact: 'Unloading charges and crane availability missing from Metro Build Supply',
      next: 'Supplier callback queued',
      state: 'In progress',
      color: 'blue',
      options: ['Trigger automated Sarvam voice agent callback', 'Manually assign site crane team', 'Disqualify quote as non-responsive'],
    },
  ]);

  const filtered = exceptions.filter((ex) => {
    if (filter === 'All open') return ex.state === 'Open' || ex.state === 'In progress';
    if (filter === 'High impact') return ex.type.includes('shortfall') || ex.type.includes('Shortfall');
    return true;
  });

  const handleResolve = (code: string, chosenOption: string) => {
    setExceptions(
      exceptions.map((ex) =>
        ex.code === code ? { ...ex, state: 'Resolved', color: 'green', next: 'Closed with evidence' } : ex
      )
    );
    setSelectedException(null);
    showToast(`Exception ${code} resolved: ${chosenOption}. Audit log updated.`);
    if (onReviewRecovery) onReviewRecovery(code);
  };

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
          <h1>Exceptions &amp; Delivery Recovery</h1>
          <p>
            {exceptions.filter((e) => e.state === 'Open').length} open exceptions requiring active buyer authorization
          </p>
        </div>
        <div className="head-actions">
          <button
            className="btn btn-secondary"
            onClick={() => {
              setFilter('High impact');
              showToast('Filtering for high-impact shortfalls and delivery delays.');
            }}
          >
            Review Priority Queue
          </button>
        </div>
      </div>

      {/* Metric Counters */}
      <div className="grid metrics">
        <div className="metric">
          <div className="metric-top">Open exceptions</div>
          <strong style={{ color: '#b45309' }}>
            {exceptions.filter((e) => e.state === 'Open').length}
          </strong>
          <small>Require buyer decision</small>
        </div>
        <div className="metric">
          <div className="metric-top">Awaiting supplier</div>
          <strong>1</strong>
          <small>Vendor callback queued</small>
        </div>
        <div className="metric">
          <div className="metric-top">Awaiting buyer</div>
          <strong>1</strong>
          <small>Shortfall recovery open</small>
        </div>
        <div className="metric">
          <div className="metric-top">Resolved today</div>
          <strong style={{ color: '#15803d' }}>
            {exceptions.filter((e) => e.state === 'Resolved').length + 4}
          </strong>
          <small>Closed with evidence</small>
        </div>
      </div>

      {/* Exceptions Table Panel */}
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Active Recovery Queue</h2>
            <p>Every case requires verified evidence before closure. No premature resolution.</p>
          </div>
          <select
            className="filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Filter exceptions"
          >
            <option>All open</option>
            <option>High impact</option>
          </select>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Exception</th>
                <th>Type</th>
                <th>Related Record</th>
                <th>Known Impact</th>
                <th>Next Action</th>
                <th>State</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((ex) => (
                <tr
                  key={ex.code}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelectedException(ex)}
                >
                  <td>
                    <strong style={{ color: '#1e40af' }}>{ex.code}</strong>
                  </td>
                  <td>
                    <strong>{ex.type}</strong>
                  </td>
                  <td>{ex.related}</td>
                  <td>{ex.impact}</td>
                  <td>
                    <span style={{ fontSize: '11.5px', color: '#475569' }}>{ex.next}</span>
                  </td>
                  <td>
                    <span className={`pill ${ex.color}`}>
                      <span className="dot"></span>
                      {ex.state}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="row-action"
                      style={{ color: '#1e40af', fontWeight: 600 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedException(ex);
                      }}
                    >
                      Resolve →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Exception Resolution Modal */}
      {selectedException && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setSelectedException(null)}>
          <div className="modal" style={{ maxWidth: '580px' }}>
            <div className="modal-head">
              <div>
                <div className="eyebrow">EXCEPTION RECOVERY DECISION · {selectedException.code}</div>
                <h2>{selectedException.type}</h2>
                <p>{selectedException.related}</p>
              </div>
              <button className="icon-btn" onClick={() => setSelectedException(null)}>×</button>
            </div>
            <div style={{ padding: '16px' }}>
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  padding: '12px',
                  fontSize: '12px',
                  color: '#991b1b',
                  marginBottom: '16px',
                  lineHeight: 1.5,
                }}
              >
                <strong>Operational Impact:</strong> {selectedException.impact}
              </div>

              <div>
                <strong style={{ display: 'block', fontSize: '12px', color: '#0f172a', marginBottom: '8px' }}>
                  Select Recovery Action:
                </strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedException.options?.map((opt: string, i: number) => (
                    <button
                      key={i}
                      className="panel"
                      style={{
                        padding: '12px 14px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: '12px',
                        color: '#1e293b',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        transition: 'border-color 0.15s, background 0.15s',
                        borderRadius: '6px',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#3b82f6';
                        e.currentTarget.style.background = '#eff6ff';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#cbd5e1';
                        e.currentTarget.style.background = '#ffffff';
                      }}
                      onClick={() => handleResolve(selectedException.code, opt)}
                    >
                      <strong style={{ display: 'block', color: '#1e40af', marginBottom: '2px' }}>
                        Option {i + 1}:
                      </strong>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="wizard-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedException(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
