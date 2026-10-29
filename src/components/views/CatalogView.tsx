'use client';

import React from 'react';

interface CatalogViewProps {
  onAddProduct?: () => void;
  onImport?: () => void;
}

export function CatalogView({ onAddProduct, onImport }: CatalogViewProps) {
  const items = [
    { name: 'TMT Steel · Fe 550D', desc: '12 mm · manufacturer variants mapped', code: 'STEEL', status: 'Verified', statusColor: 'green', mappings: '2 supplier mappings' },
    { name: 'Cement · OPC 53', desc: '50 kg bag · type/grade specific', code: 'CEM', status: 'Verified', statusColor: 'green', mappings: '4 supplier mappings' },
    { name: 'Cement · PPC', desc: '50 kg bag · brand variant required', code: 'CEM', status: 'Partially verified', statusColor: 'blue', mappings: '3 supplier mappings' },
    { name: 'RMC · M25', desc: 'Grade and pour-slot fields configured', code: 'RMC', status: 'Schema only', statusColor: 'blue', mappings: '0 supplier mappings' },
    { name: 'M-sand · Zone II', desc: 'Grading & delivered quantity required', code: 'SAND', status: 'Provisional', statusColor: 'amber', mappings: '1 supplier candidate' },
    { name: 'Waterproofing membrane', desc: 'Product family not yet verified', code: 'CHEM', status: 'Needs review', statusColor: 'amber', mappings: '0 supplier mappings' },
  ];

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Product catalogue</h1>
          <p>India · TMT steel and cement deep coverage</p>
        </div>
        <div className="head-actions">
          <button className="btn btn-secondary" onClick={onImport}>
            Import
          </button>
          <button className="btn btn-primary" onClick={onAddProduct}>
            Add product
          </button>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Catalogue records</h2>
            <p>India-first · TMT and cement are the deep-coverage categories</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              className="filter"
              placeholder="Search name, brand, IS ref, SKU…"
              style={{ minWidth: '210px' }}
              aria-label="Search catalogue"
            />
            <select className="filter" aria-label="Filter category">
              <option>All categories</option>
              <option>TMT steel</option>
              <option>Cement</option>
            </select>
            <select className="filter" aria-label="Filter status">
              <option>All statuses</option>
              <option>Verified</option>
              <option>Provisional</option>
            </select>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Key attributes</th>
                <th>Status</th>
                <th>Supplier mappings</th>
                <th>Source status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.name}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                      <div
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '6px',
                          background: '#f1f3f6',
                          color: '#677487',
                          fontSize: '9px',
                          fontWeight: 650,
                          display: 'grid',
                          placeItems: 'center',
                          border: '1px solid #dfe7f5',
                        }}
                      >
                        {it.code}
                      </div>
                      <div>
                        <strong>{it.name}</strong>
                        <span className="sub">Canonical product · sample record</span>
                      </div>
                    </div>
                  </td>
                  <td>{it.desc}</td>
                  <td>
                    <span className={`pill ${it.statusColor}`}>
                      <span className="dot"></span>
                      {it.status}
                    </span>
                  </td>
                  <td>{it.mappings}</td>
                  <td>
                    <span style={{ color: 'var(--muted)' }}>Traceable source required</span>
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
