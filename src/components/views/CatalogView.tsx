'use client';

import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Search,
  Plus,
  X,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';
import { getProductVisualAsset } from '@/lib/catalogue/product-images';

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
  mandatoryAttributes: Record<string, any> | string[];
  conversionFactors: Record<string, any>;
  verificationStatus: string;
  notes: string | null;
}

interface CatalogViewProps {
  onAddProduct?: () => void;
  onImport?: () => void;
  onInitiateRequest?: (params: { category: 'tmt_rebar' | 'cement'; grade?: string; diameter?: string }) => void;
}

export function CatalogView({ onAddProduct, onImport, onInitiateRequest }: CatalogViewProps) {
  const [products, setProducts] = useState<CanonicalProductSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedProduct, setSelectedProduct] = useState<CanonicalProductSummary | null>(null);
  const [isProposeModalOpen, setIsProposeModalOpen] = useState(false);
  const [proposeForm, setProposeForm] = useState({
    name: '',
    category: 'tmt_rebar',
    standard: '',
    notes: '',
  });
  const [actionNotice, setActionNotice] = useState<string | null>(null);

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
      .catch((err) => {
        console.error('Error fetching catalogue:', err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredProducts = products.filter((p) => {
    // Category filter
    if (categoryFilter !== 'ALL' && p.categoryId !== categoryFilter) {
      return false;
    }
    // Status filter
    if (statusFilter !== 'ALL' && p.verificationStatus !== statusFilter) {
      return false;
    }
    // Search
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const matchName = p.canonicalName.toLowerCase().includes(q);
    const matchStd = p.applicableStandard.toLowerCase().includes(q);
    const matchId = p.id.toLowerCase().includes(q);
    return matchName || matchStd || matchId;
  });

  const verifiedCount = products.filter((p) => p.verificationStatus === 'verified_standard_spec').length;
  const provisionalCount = products.filter((p) => p.verificationStatus === 'provisional_reference_spec').length;

  const handleInitiate = (product: CanonicalProductSummary) => {
    if (!onInitiateRequest) return;
    const isCement = product.categoryId === 'cement' || product.id.startsWith('CP-CEM');
    const isSteel = product.categoryId === 'tmt_rebar' || product.id.startsWith('CP-TMT');

    let grade: string | undefined;
    let diameter: string | undefined;

    if (isSteel) {
      if (product.canonicalName.includes('500D')) grade = 'Fe 500D';
      else if (product.canonicalName.includes('550D')) grade = 'Fe 550D';
      else if (product.canonicalName.includes('415D')) grade = 'Fe 415D';
      else if (product.canonicalName.includes('CRS')) grade = 'CRS Fe 500D';

      const matchDia = product.canonicalName.match(/(\d+)\s*mm/i);
      if (matchDia) diameter = matchDia[1];
    } else if (isCement) {
      if (product.canonicalName.includes('53')) grade = 'OPC 53';
      else if (product.canonicalName.includes('43')) grade = 'OPC 43';
      else if (product.canonicalName.includes('PPC')) grade = 'PPC';
      else if (product.canonicalName.includes('PSC') || product.canonicalName.includes('Slag')) grade = 'PSC';
    }

    onInitiateRequest({
      category: isCement ? 'cement' : 'tmt_rebar',
      grade,
      diameter,
    });
  };

  const handleProposeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsProposeModalOpen(false);
    setActionNotice(`Specification “${proposeForm.name}” submitted for engineering review.`);
    setProposeForm({ name: '', category: 'tmt_rebar', standard: '', notes: '' });
    setTimeout(() => setActionNotice(null), 4000);
  };

  return (
    <div>
      {/* Toast Notification */}
      {actionNotice && (
        <div className="toast" style={{ top: '24px', zIndex: 1100 }}>
          {actionNotice}
        </div>
      )}

      {/* Page Header */}
      <div className="page-head">
        <div>
          <h1>Product Catalogue</h1>
          <p>BIS statutory construction standards, verified specifications, and conversion rules</p>
        </div>
        <div className="head-actions">
          <button
            className="btn btn-secondary"
            onClick={() => {
              if (onImport) onImport();
              else {
                setActionNotice('Catalogue specifications updated to active BIS release baseline.');
                setTimeout(() => setActionNotice(null), 3000);
              }
            }}
          >
            Import Standard Spec
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setIsProposeModalOpen(true)}
          >
            + Propose Specification
          </button>
        </div>
      </div>

      {/* Main Catalogue Panel */}
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Canonical Products ({filteredProducts.length})</h2>
            <p>Conforming strictly to BIS statutory standards (IS 1786:2008 &amp; IS 269/1489/455)</p>
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
                  <th>Product &amp; Visual Spec</th>
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
                  const visual = getProductVisualAsset(p.id, p.categoryId);

                  return (
                    <tr key={p.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {/* Authentic Product Photograph / Vector Asset */}
                          <div
                            style={{
                              width: '46px',
                              height: '46px',
                              borderRadius: '8px',
                              overflow: 'hidden',
                              border: '1px solid #cbd5e1',
                              background: '#0f172a',
                              flex: 'none',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                            }}
                          >
                            <img
                              src={visual.imagePath}
                              alt={p.canonicalName}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          </div>
                          <div>
                            <strong style={{ color: '#0f172a', fontSize: '13px' }}>{p.canonicalName}</strong>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
                              <span className="sub" style={{ fontSize: '10.5px' }}>{p.id}</span>
                              <span style={{ fontSize: '9.5px', color: '#64748b' }}>•</span>
                              <span style={{ fontSize: '10px', color: visual.badgeColor === 'green' ? '#15803d' : '#0369a1', fontWeight: 600 }}>
                                {visual.isRepresentative ? 'Representative Asset' : 'Statutory BIS Spec'}
                              </span>
                            </div>
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
                      <td style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <button
                          className="row-action"
                          onClick={() => setSelectedProduct(p)}
                        >
                          Specs &amp; Photo
                        </button>
                        {onInitiateRequest && (
                          <button
                            className="row-action"
                            style={{ color: '#1e40af', fontWeight: 600 }}
                            onClick={() => handleInitiate(p)}
                          >
                            Procure →
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Product Details Drawer / Modal with Authentic Photography & Visual Asset */}
      {selectedProduct && (() => {
        const visual = getProductVisualAsset(selectedProduct.id, selectedProduct.categoryId);

        return (
          <div
            className="modal-backdrop"
            onClick={(e) => e.target === e.currentTarget && setSelectedProduct(null)}
          >
            <div className="modal" style={{ maxWidth: '620px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
              <div className="modal-head" style={{ flex: 'none' }}>
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

              <div style={{ padding: '16px', overflowY: 'auto', flex: 1 }}>
                {/* Hero Product Visual Display */}
                <div
                  style={{
                    background: '#0f172a',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    border: '1px solid #334155',
                    marginBottom: '16px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  }}
                >
                  <div style={{ position: 'relative', width: '100%', height: '220px' }}>
                    <img
                      src={visual.imagePath}
                      alt={selectedProduct.canonicalName}
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        background: 'rgba(15, 23, 42, 0.85)',
                        backdropFilter: 'blur(4px)',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        fontSize: '10px',
                        fontWeight: 700,
                        color: visual.badgeColor === 'green' ? '#4ade80' : '#60a5fa',
                        letterSpacing: '0.5px',
                      }}
                    >
                      {visual.badge}
                    </div>
                  </div>

                  {/* Asset Source & Attribution Bar */}
                  <div
                    style={{
                      background: '#1e293b',
                      padding: '10px 14px',
                      borderTop: '1px solid #334155',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      fontSize: '10.5px',
                      color: '#94a3b8',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span><strong>Source:</strong> {visual.attribution}</span>
                      <span style={{ color: '#cbd5e1' }}><strong>Licensing:</strong> {visual.licensing}</span>
                    </div>
                    <div style={{ color: '#e2e8f0', fontStyle: 'italic', fontSize: '10px' }}>
                      Representative illustration only &middot; Conforming to BIS geometric profile. Not product photograph or certification evidence.
                    </div>
                  </div>
                </div>

                {/* Key Technical Properties */}
                <div className="panel" style={{ padding: '14px', marginBottom: '14px' }}>
                  <div className="kv">
                    <span>Applicable Standard</span>
                    <strong>{selectedProduct.applicableStandard}</strong>
                  </div>
                  <div className="kv">
                    <span>Edition &amp; Status</span>
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
                  <div className="kv">
                    <span>Allowed Procurement Units</span>
                    <span>{Array.isArray(selectedProduct.allowedUoms) ? selectedProduct.allowedUoms.join(', ') : selectedProduct.primaryUom}</span>
                  </div>
                </div>

                {/* Theoretical Conversions & Calculations */}
                {selectedProduct.conversionFactors && (
                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '12px',
                      fontSize: '11px',
                      color: '#334155',
                      marginBottom: '14px',
                    }}
                  >
                    <strong style={{ display: 'block', marginBottom: '6px', color: '#0f172a' }}>
                      Theoretical Conversions &amp; Calculations (IS Nominal Standards):
                    </strong>
                    <pre
                      style={{
                        marginTop: '4px',
                        background: '#ffffff',
                        padding: '10px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        border: '1px solid #e2e8f0',
                        overflowX: 'auto',
                      }}
                    >
                      {JSON.stringify(selectedProduct.conversionFactors, null, 2)}
                    </pre>
                    <p style={{ margin: '8px 0 0', color: '#64748b', fontSize: '10.5px' }}>
                      {visual.notes}
                    </p>
                  </div>
                )}
              </div>

              <div className="wizard-footer" style={{ flex: 'none', borderTop: '1px solid #e2e8f0' }}>
                <button className="btn btn-secondary" onClick={() => setSelectedProduct(null)}>
                  Close
                </button>
                {onInitiateRequest && (
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      setSelectedProduct(null);
                      handleInitiate(selectedProduct);
                    }}
                  >
                    Initiate Procurement for this Product →
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Propose Specification Modal */}
      {isProposeModalOpen && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setIsProposeModalOpen(false)}>
          <div className="modal" style={{ maxWidth: '480px' }}>
            <form onSubmit={handleProposeSubmit}>
              <div className="modal-head">
                <div>
                  <div className="eyebrow">STANDARDS ENGINEERING</div>
                  <h2>Propose Specification</h2>
                  <p>Submit a non-standard or provisional material specification for review</p>
                </div>
                <button type="button" className="icon-btn" onClick={() => setIsProposeModalOpen(false)}>×</button>
              </div>
              <div style={{ padding: '16px' }}>
                <div className="field" style={{ marginBottom: '12px' }}>
                  <label>Material Specification Title *</label>
                  <input
                    required
                    placeholder="e.g. Fe 600 High Strength Seismic Rebar 16mm"
                    value={proposeForm.name}
                    onChange={(e) => setProposeForm({ ...proposeForm, name: e.target.value })}
                  />
                </div>
                <div className="form-grid" style={{ marginBottom: '12px' }}>
                  <div className="field">
                    <label>Category</label>
                    <select
                      value={proposeForm.category}
                      onChange={(e) => setProposeForm({ ...proposeForm, category: e.target.value })}
                    >
                      <option value="tmt_rebar">TMT Reinforcement Steel</option>
                      <option value="cement">Cement &amp; Mineral Binders</option>
                      <option value="structural_steel">Structural Steel</option>
                      <option value="rmc">Ready-Mix Concrete</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Governing Standard</label>
                    <input
                      placeholder="e.g. IS 1786 Table 3"
                      value={proposeForm.standard}
                      onChange={(e) => setProposeForm({ ...proposeForm, standard: e.target.value })}
                    />
                  </div>
                </div>
                <div className="field">
                  <label>Engineering Justification / Testing Evidence</label>
                  <textarea
                    rows={3}
                    placeholder="Provide ASTM/IS standard edition, mill test certificate reference or structural necessity notes..."
                    value={proposeForm.notes}
                    onChange={(e) => setProposeForm({ ...proposeForm, notes: e.target.value })}
                  />
                </div>
              </div>
              <div className="wizard-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsProposeModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Submit for Engineering Review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
