'use client';

import React from 'react';

interface ExceptionsViewProps {
  onReviewRecovery?: (code: string) => void;
}

export function ExceptionsView({ onReviewRecovery }: ExceptionsViewProps) {
  const exceptions = [
    { code: 'EX-008', type: 'Supplier shortfall', related: 'PO-0259 · TMT steel', impact: '8 tonnes not confirmed', next: 'Supplier sourcing', state: 'Open', color: 'amber' },
    { code: 'EX-007', type: 'ETA changed', related: 'PO-0260 · Cement', impact: 'Delivery moved by one day', next: 'Buyer decision', state: 'Open', color: 'amber' },
    { code: 'EX-006', type: 'Incomplete quote', related: 'KOV-1028 · TMT steel', impact: 'Unloading charge missing', next: 'Supplier callback', state: 'In progress', color: 'blue' },
  ];

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Exceptions</h1>
          <p>2 open · 1 in progress</p>
        </div>
        <div className="head-actions">
          <button className="btn btn-secondary">Review queue</button>
        </div>
      </div>

      <div className="grid metrics">
        <div className="metric">
          <div className="metric-top">Open exceptions</div>
          <strong>2</strong>
          <small>Require action today</small>
        </div>
        <div className="metric">
          <div className="metric-top">Awaiting supplier</div>
          <strong>1</strong>
          <small>Callback scheduled</small>
        </div>
        <div className="metric">
          <div className="metric-top">Awaiting buyer</div>
          <strong>1</strong>
          <small>Decision required</small>
        </div>
        <div className="metric">
          <div className="metric-top">Closed today</div>
          <strong>4</strong>
          <small>Demo records only</small>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Recovery queue</h2>
            <p>Don&apos;t mark a case resolved because a call was attempted. Closure requires verified evidence.</p>
          </div>
          <select className="filter" aria-label="Filter exceptions">
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
                <th>Related record</th>
                <th>Known impact</th>
                <th>Next action</th>
                <th>State</th>
              </tr>
            </thead>
            <tbody>
              {exceptions.map((ex) => (
                <tr key={ex.code}>
                  <td>
                    <strong>{ex.code}</strong>
                  </td>
                  <td>{ex.type}</td>
                  <td>{ex.related}</td>
                  <td>{ex.impact}</td>
                  <td>{ex.next}</td>
                  <td>
                    <span className={`pill ${ex.color}`}>
                      <span className="dot"></span>
                      {ex.state}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
