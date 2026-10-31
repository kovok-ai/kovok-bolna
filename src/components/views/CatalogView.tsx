'use client';

import React, { useState, useEffect } from 'react';

interface CanonicalProductSummary {
  id: string;
  categoryId: string;
  categoryName: string;
  canonicalName: string;
  standardProductType: string;
  applicableStandard: string;
  standardEditionStatus: string;
  primaryUom: string;
  allowedUoms: string[];
  mandatoryAttributes: string[];
  conversionFactors: Record<string, any>;
  verificationStatus: string;
  notes: string | null;
}

interface CatalogViewProps {
  onAddProduct?: () => void;
  onImport?: () => void;
}

export function CatalogView({ onAddProduct, onImport }: CatalogViewProps) {
  const [products, setProducts] = useState<CanonicalProductSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedProduct, setSelectedProduct] = useState<CanonicalProductSummary | null>(null);

  useEffect(() => {
    fetch('/api/catalogue/products')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load catalogue');
        return res.json();
      })
      .then((data) => {
        if (data?.products) {
          setProducts(data.products);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filteredProducts = products.filter((p) => {
    if (categoryFilter !== 'ALL' && p.categoryId !== categoryFilter) return false;
    if (statusFilter !== 'ALL' && p.verificationStatus !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const match =
        p.canonicalName.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        p.applicableStandard.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const verifiedCount = products.filter((p) => p.verificationStatus === 'verified_standard_spec').length;
  const provisionalCount = products.filter((p) => p.verificationStatus === 'provisional_reference_spec').length;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Indian Construction Material Catalogue</h1>
          <p>
            Standard Reference Specifications · {verifiedCount} Core Verified · {provisionalCount} Provisional Reference
          </p>
        </div>
        <div className="head-actions">
          <button className="btn btn-secondary" onClick={onImport}>
            Import Staging Report
          </button>
          <button className="btn btn-primary" onClick={onAddProduct}>
            Propose Specification
          </button>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Canonical Products ({filteredProducts.length})</h2>
            <p>Conforming strictly to BIS statutory standards (IS 1786:2008 & IS 269/1489/455)</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              className="filter"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search product, IS standard, ID…"
              style={{ minWidth: '220px' }}
              aria-label="Search catalogue"
            />
            <select
              className="filter"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label="Filter category"
            >
              <option value="ALL">All categories</option>
              <option value="tmt_rebar">TMT Steel (IS 1786)</option>
              <option value="cement">Cement (IS 269/1489/455)</option>
            </select>
            <select
              className="filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter status"
            >
              <option value="ALL">All statuses</option>
              <option value="verified_standard_spec">Verified Standard Spec ({verifiedCount})</option>
              <option value="provisional_reference_spec">Provisional Reference ({provisionalCount})</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
            Loading catalogue products...
          </div>
        ) : error ? (
          <div style={{ padding: '24px' }} className="alert">
            Error loading catalogue: {error}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Statutory Standard</th>
                  <th>Primary UOM</th>
                  <th>Verification Status</th>
                  <th>Allowed Units</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => {
                  const isVerified = p.verificationStatus === 'verified_standard_spec';
                  const isSteel = p.categoryId === 'tmt_rebar';
                  const glyph = isSteel ? 'STEEL' : 'CEM';
                  return (
                    <tr key={p.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '6px',
                              background: isSteel ? '#f0f4ff' : '#fef2f2',
                              color: isSteel ? '#1e40af' : '#991b1b',
                              fontSize: '10px',
                              fontWeight: 700,
                              display: 'grid',
                              placeItems: 'center',
                              border: `1px solid ${isSteel ? '#dbeafe' : '#fee2e2'}`,
                              flex: 'none'
                            }}
                          >
                            {glyph}
                          </div>
                          <div>
                            <strong>{p.canonicalName}</strong>
                            <span className="sub">{p.id}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <strong>{p.applicableStandard}</strong>
                        <span className="sub">{p.standardEditionStatus}</span>
                      </td>
                      <td>{p.primaryUom}</td>
                      <td>
                        <span className={`pill ${isVerified ? 'green' : 'amber'}`}>
                          <span className="dot"></span>
                          {isVerified ? 'Verified Standard' : 'Provisional Reference'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '11px', color: '#475569' }}>
                          {Array.isArray(p.allowedUoms) ? p.allowedUoms.join(', ') : p.primaryUom}
                        </span>
                      </td>
                      <td>
                        <button
                          className="row-action"
                          onClick={() => setSelectedProduct(p)}
                        >
                          Specs →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Product Details Drawer / Modal */}
      {selectedProduct && (
        <div
          className="modal-backdrop"
          onClick={(e) => e.target === e.currentTarget && setSelectedProduct(null)}
        >
          <div className="modal" style={{ maxWidth: '580px' }}>
            <div className="modal-head">
              <div>
                <div className="eyebrow">CANONICAL PRODUCT SPECIFICATION</div>
                <h2>{selectedProduct.canonicalName}</h2>
                <p>Code: {selectedProduct.id}</p>
              </div>
              <button
                className="icon-btn"
                onClick={() => setSelectedProduct(null)}
                aria-label="Close details"
              >
                ×
              </button>
            </div>
            <div style={{ padding: '16px' }}>
              <div className="panel" style={{ padding: '14px', marginBottom: '14px' }}>
                <div className="kv">
                  <span>Applicable Standard</span>
                  <strong>{selectedProduct.applicableStandard}</strong>
                </div>
                <div className="kv">
                  <span>Edition & Status</span>
                  <span>{selectedProduct.standardEditionStatus}</span>
                </div>
                <div className="kv">
                  <span>Verification Eligibility</span>
                  <span
                    className={`pill ${
                      selectedProduct.verificationStatus === 'verified_standard_spec' ? 'green' : 'amber'
                    }`}
                  >
                    {selectedProduct.verificationStatus}
                  </span>
                </div>
                <div className="kv">
                  <span>Primary Unit of Measure</span>
                  <strong>{selectedProduct.primaryUom}</strong>
                </div>
              </div>

              {selectedProduct.conversionFactors && (
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '12px',
                    fontSize: '11px',
                    color: '#334155'
                  }}
                >
                  <strong>Theoretical Conversions & Calculations:</strong>
                  <pre
                    style={{
                      marginTop: '6px',
                      background: '#ffffff',
                      padding: '8px',
                      borderRadius: '4px',
                      fontSize: '10.5px',
                      overflowX: 'auto'
                    }}
                  >
                    {JSON.stringify(selectedProduct.conversionFactors, null, 2)}
                  </pre>
                  <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: '10px' }}>
                    Note: Product media is quarantined from commercial display pending physical batch test certification. Visual displays utilize deterministic SVG glyphs.
                  </p>
                </div>
              )}
            </div>
            <div className="wizard-footer">
              <div></div>
              <button className="btn btn-primary" onClick={() => setSelectedProduct(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
