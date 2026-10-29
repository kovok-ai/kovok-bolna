'use client';

import React from 'react';

export function SuppliersView() {
  const suppliers = [
    { name: 'Shakti Steel & Co.', capability: 'TMT/rebar · Fe 500D/550D', area: 'Gurugram · 122001', lang: 'Hindi, English', history: '12 verified orders', status: 'Preferred', color: 'green' },
    { name: 'Sunrise Cement Traders', capability: 'OPC / PPC · multiple brands', area: 'Dwarka · 110075', lang: 'Hindi, English', history: '21 verified orders', status: 'Active', color: 'blue' },
    { name: 'Northline Metals', capability: 'TMT and structural steel', area: 'Delhi NCR', lang: 'Hindi, English', history: '4 orders', status: 'Active', color: 'blue' },
    { name: 'Metro Build Supply', capability: 'Cement · chemicals', area: 'Faridabad · 121001', lang: 'Hindi', history: 'No completed orders', status: 'New', color: 'amber' },
  ];

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Suppliers</h1>
          <p>Saved distributors and verified capabilities</p>
        </div>
        <div className="head-actions">
          <button className="btn btn-secondary">Import</button>
          <button className="btn btn-primary">Add supplier</button>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Supplier directory</h2>
            <p>Saved suppliers first; discover new suppliers only when permitted and useful.</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              className="filter"
              placeholder="Supplier, material, PIN code…"
              aria-label="Filter suppliers"
            />
            <select className="filter" aria-label="Filter status">
              <option>All suppliers</option>
              <option>Preferred</option>
              <option>Needs verification</option>
            </select>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Material capability</th>
                <th>Service area</th>
                <th>Languages</th>
                <th>Observed history</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.name}>
                  <td>
                    <strong>{s.name}</strong>
                  </td>
                  <td>{s.capability}</td>
                  <td>{s.area}</td>
                  <td>{s.lang}</td>
                  <td>{s.history}</td>
                  <td>
                    <span className={`pill ${s.color}`}>
                      <span className="dot"></span>
                      {s.status}
                    </span>
                  </td>
                  <td>
                    <button className="row-action">Open →</button>
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
