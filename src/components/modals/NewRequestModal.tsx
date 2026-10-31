'use client';

import React, { useState, useEffect } from 'react';
import {
  calculateRebarConversions,
  matchProcurementRequirement,
  RebarCalculations,
  MatchResult,
} from '@/lib/procurement/intake';
import { getProductVisualAsset } from '@/lib/catalogue/product-images';

interface SiteOption {
  id: string;
  siteName: string;
  pinCode: string;
  city: string;
}

interface NewRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (requestData: any) => void;
  initialCategory?: 'tmt_rebar' | 'cement';
  initialGrade?: string;
  initialDiameter?: string;
}

export function NewRequestModal({
  isOpen,
  onClose,
  onSubmit,
  initialCategory,
  initialGrade,
  initialDiameter,
}: NewRequestModalProps) {
  const [step, setStep] = useState(0);
  const [category, setCategory] = useState<'tmt_rebar' | 'cement'>('tmt_rebar');
  const [description, setDescription] = useState('20 tonnes of TMT steel for Gurugram site');
  const [grade, setGrade] = useState('Fe 500D');
  const [diameter, setDiameter] = useState('12');
  const [cementType, setCementType] = useState('OPC 53');
  const [cementPack, setCementPack] = useState('50 kg bag');
  const [quantity, setQuantity] = useState('20');
  const [unit, setUnit] = useState<'TONNES' | 'BAGS' | 'PIECES'>('TONNES');
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [buyerNotes, setBuyerNotes] = useState('');
  const [deliveryBasis, setDeliveryBasis] = useState('Delivered at site');
  const [confirmed, setConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<any>(null);
  const [conversion, setConversion] = useState<RebarCalculations | null>(null);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);

  // Initialize or reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep(0);
      setConfirmed(false);
      setSubmissionResult(null);

      if (initialCategory) {
        setCategory(initialCategory);
        setUnit(initialCategory === 'cement' ? 'BAGS' : 'TONNES');
      }
      if (initialGrade) {
        if (initialCategory === 'cement') {
          setCementType(initialGrade);
        } else {
          setGrade(initialGrade);
        }
      }
      if (initialDiameter) {
        setDiameter(initialDiameter);
      }

      // Fetch active workspace sites
      fetch('/api/workspaces')
        .then((res) => res.json())
        .then((data) => {
          if (data?.sites && data.sites.length > 0) {
            setSites(data.sites);
            setSelectedSiteId(data.sites[0].id);
          }
        })
        .catch((err) => console.error('Failed to load workspace sites:', err));
    }
  }, [isOpen, initialCategory, initialGrade, initialDiameter]);

  // Live matching and rebar conversion engine
  useEffect(() => {
    const qVal = parseFloat(quantity) || 0;
    const diamVal = category === 'tmt_rebar' ? parseFloat(diameter) || undefined : undefined;
    const targetGrade = category === 'tmt_rebar' ? grade : cementType;

    const match = matchProcurementRequirement(
      category,
      targetGrade,
      diamVal,
      qVal,
      unit,
      buyerNotes ? buyerNotes : description
    );
    setMatchResult(match);

    if (category === 'tmt_rebar' && diamVal) {
      setConversion(calculateRebarConversions(diamVal, qVal, unit));
    } else {
      setConversion(null);
    }
  }, [category, grade, diameter, cementType, quantity, unit, buyerNotes, description]);

  if (!isOpen) return null;

  const titles = ['What do you need?', 'Identify the material', 'Delivery & sourcing', 'Review and send'];
  const captions = [
    'Describe it in your own words. Kovok will ask for the missing details.',
    'Confirm statutory attributes. Kovok resolves canonical specifications.',
    'Tell Kovok where and when it is needed.',
    'Check all details before submitting into procurement workflow.',
  ];

  const handleNext = async () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      if (!confirmed) {
        alert('Please check the confirmation box to verify your procurement specification.');
        return;
      }
      if (!selectedSiteId) {
        alert('Please select an active project site.');
        return;
      }

      setIsSubmitting(true);
      try {
        const payload = {
          siteId: selectedSiteId,
          materialCategoryId: category,
          targetGrade: category === 'tmt_rebar' ? grade : cementType,
          targetDiameterMm: category === 'tmt_rebar' ? parseFloat(diameter) : undefined,
          quantityValue: parseFloat(quantity) || 1,
          quantityUnit: unit,
          buyerNotes: buyerNotes ? buyerNotes : description,
        };

        const res = await fetch('/api/procurement/requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok) {
          alert(`Submission error: ${data.error || 'Failed to submit'}`);
          setIsSubmitting(false);
          return;
        }

        setSubmissionResult(data);
        onSubmit({
          ...payload,
          requestCode: data.request.requestCode,
          status: data.request.requestStatus,
          clarificationReason: data.request.clarificationReason,
        });
      } catch (err: any) {
        alert(`Error submitting request: ${err.message}`);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const selectedSite = sites.find((s) => s.id === selectedSiteId);

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle" style={{ maxWidth: '640px' }}>
        {/* Modal Header */}
        <div className="modal-head">
          <div>
            <div className="eyebrow">NEW PURCHASE REQUEST · STEP {step + 1} OF 4</div>
            <h2 id="modalTitle">{titles[step]}</h2>
            <p>{captions[step]}</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close modal">
            ×
          </button>
        </div>

        {/* Stepper */}
        <div className="wizard-main">
          <div className="stepper">
            {['Describe', 'Identify', 'Delivery & sourcing', 'Review'].map((t, i) => (
              <div
                key={t}
                className={`step ${i === step ? 'active' : i < step ? 'done' : ''}`}
              >
                <span className="num">{i < step ? '✓' : i + 1}</span>
                <span className="crumb-full">{t}</span>
              </div>
            ))}
          </div>

          {/* Step 0: Describe */}
          {step === 0 && (
            <div>
              <div
                style={{
                  border: '1px solid #d9e5ff',
                  background: '#f5f8ff',
                  padding: '14px',
                  borderRadius: '12px',
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'center',
                  marginBottom: '18px',
                }}
              >
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    background: '#e1eaff',
                    color: '#2f5fbd',
                    fontSize: '17px',
                    flex: 'none',
                  }}
                >
                  ⚡
                </div>
                <div>
                  <strong style={{ fontSize: '12px' }}>Intelligent Material Intake</strong>
                  <p style={{ fontSize: '11px', color: '#64748b', margin: '4px 0 0' }}>
                    Describe your procurement requirements. Kovok resolves specifications against Indian statutory standards (IS 1786 / IS 269) and preserves buyer intent without silent substitution.
                  </p>
                </div>
              </div>

              <div className="field" style={{ marginBottom: '14px' }}>
                <label>What do you need?</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. 20 tonnes of TMT steel Fe 500D 12mm for Gurugram site..."
                  rows={3}
                />
              </div>

              <div className="form-grid">
                <div className="field">
                  <label>Material category</label>
                  <select
                    value={category}
                    onChange={(e) => {
                      const c = e.target.value as any;
                      setCategory(c);
                      setUnit(c === 'cement' ? 'BAGS' : 'TONNES');
                    }}
                  >
                    <option value="tmt_rebar">TMT Steel (IS 1786:2008)</option>
                    <option value="cement">Cement (IS 269 / IS 1489 / IS 455)</option>
                  </select>
                </div>
                <div className="field">
                  <label>Request source</label>
                  <select>
                    <option>Standard Buyer Intake (Phase 2)</option>
                    <option>Site Indent Requisition</option>
                    <option>Repeat Purchase Order</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Identify */}
          {step === 1 && (
            <div>
              <div className="alert" style={{ marginBottom: '14px' }}>
                Only statutory required attributes are mandatory. Verified products match BIS standards; non-preferred or unlisted sizes route to engineering clarification.
              </div>

              {category === 'tmt_rebar' ? (
                <div>
                  <div className="form-grid three" style={{ marginBottom: '14px' }}>
                    <div className="field">
                      <label>Grade / Designation *</label>
                      <select value={grade} onChange={(e) => setGrade(e.target.value)}>
                        <option value="Fe 500D">Fe 500D (Core Standard)</option>
                        <option value="Fe 550D">Fe 550D (High Strength Ductile)</option>
                        <option value="Fe 500D CRS">Fe 500D CRS (Corrosion Resistant - Provisional)</option>
                        <option value="Fe 415D">Fe 415D (Legacy Ductile - Provisional)</option>
                      </select>
                    </div>
                    <div className="field">
                      <label>Diameter (mm) *</label>
                      <select value={diameter} onChange={(e) => setDiameter(e.target.value)}>
                        <option value="8">8 mm (Core)</option>
                        <option value="10">10 mm (Core)</option>
                        <option value="12">12 mm (Core)</option>
                        <option value="14">14 mm (Unlisted Clause 6.1.1)</option>
                        <option value="16">16 mm (Core)</option>
                        <option value="20">20 mm (Core)</option>
                        <option value="25">25 mm (Core)</option>
                        <option value="28">28 mm (Provisional rolling)</option>
                        <option value="32">32 mm (Core)</option>
                        <option value="36">36 mm (Provisional civil)</option>
                        <option value="40">40 mm (Provisional civil)</option>
                      </select>
                    </div>
                    <div className="field">
                      <label>Unit *</label>
                      <select value={unit} onChange={(e) => setUnit(e.target.value as any)}>
                        <option value="TONNES">Tonnes (Metric)</option>
                        <option value="PIECES">Pieces (12m bars)</option>
                      </select>
                    </div>
                  </div>

                  {conversion && (
                    <div
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '12px',
                        marginBottom: '14px',
                        fontSize: '11px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span>Nominal mass: <strong>{conversion.nominalMassKgPerMeter} kg/m</strong></span>
                        <span>Single 12m bar mass: <strong>{conversion.singleBarMassKg} kg</strong></span>
                        <span>Bars per tonne: <strong>{conversion.theoreticalBarsPerTonne} bars</strong></span>
                      </div>
                      {conversion.totalPiecesEstimated && (
                        <div style={{ color: '#1e40af', fontWeight: 600, marginTop: '4px' }}>
                          Theoretical count: ~{conversion.totalPiecesEstimated} bars for {quantity} {unit.toLowerCase()}
                        </div>
                      )}
                      <div style={{ color: '#64748b', fontSize: '10px', marginTop: '6px', lineHeight: '1.4' }}>
                        Citation: {conversion.standardClauseCitation}
                        <br />
                        Note: {conversion.commercialBillingCaveat}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div className="form-grid three" style={{ marginBottom: '14px' }}>
                    <div className="field">
                      <label>Cement Type / Grade *</label>
                      <select value={cementType} onChange={(e) => setCementType(e.target.value)}>
                        <option value="OPC 53">OPC 53 (IS 269:2015)</option>
                        <option value="PPC Fly Ash">PPC Fly Ash (IS 1489 Pt 1)</option>
                        <option value="PSC Slag">PSC Slag (IS 455:2015)</option>
                        <option value="Composite">Composite Cement (IS 16415)</option>
                        <option value="OPC 43">OPC 43 (Provisional)</option>
                        <option value="OPC 33">OPC 33 (Provisional)</option>
                      </select>
                    </div>
                    <div className="field">
                      <label>Pack size *</label>
                      <select value={cementPack} onChange={(e) => setCementPack(e.target.value)}>
                        <option value="50 kg bag">50 kg HDPE / Paper bag</option>
                        <option value="Bulk tanker">Bulk Tanker / Silo</option>
                      </select>
                    </div>
                    <div className="field">
                      <label>Unit *</label>
                      <select value={unit} onChange={(e) => setUnit(e.target.value as any)}>
                        <option value="BAGS">Bags (50 kg)</option>
                        <option value="TONNES">Tonnes</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div className="form-grid">
                <div className="field">
                  <label>Quantity *</label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Buyer Specifications / Notes</label>
                  <input
                    value={buyerNotes}
                    onChange={(e) => setBuyerNotes(e.target.value)}
                    placeholder="e.g. Tower 3 foundation raft, test certificates required..."
                  />
                </div>
              </div>

              {/* Live Statutory Catalogue Resolution Preview */}
              {matchResult && (
                <div
                  style={{
                    marginTop: '16px',
                    padding: '14px',
                    borderRadius: '10px',
                    border: `1px solid ${matchResult.requestStatus === 'MATCHED_VERIFIED' ? '#bbf7d0' : '#fde68a'}`,
                    background: matchResult.requestStatus === 'MATCHED_VERIFIED' ? '#f0fdf4' : '#fffbeb',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: matchResult.requestStatus === 'MATCHED_VERIFIED' ? '#15803d' : '#b45309' }}>
                      {matchResult.requestStatus === 'MATCHED_VERIFIED' ? '✓ STATUTORY SPECIFICATION MATCH' : '⚠ TECHNICAL CLARIFICATION REQUIRED'}
                    </span>
                    <span className={`pill ${matchResult.requestStatus === 'MATCHED_VERIFIED' ? 'green' : 'amber'}`}>
                      <span className="dot"></span>
                      {matchResult.requestStatus === 'MATCHED_VERIFIED' ? 'Verified Match' : 'Clarification'}
                    </span>
                  </div>

                  {(() => {
                    const visual = getProductVisualAsset(matchResult.canonicalProductId, category);
                    return (
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '6px' }}>
                        <div
                          style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            border: '1px solid #cbd5e1',
                            background: '#0f172a',
                            flex: 'none',
                          }}
                        >
                          <img
                            src={visual.imagePath}
                            alt="Canonical Material Spec"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </div>
                        <div>
                          {matchResult.canonicalProductId ? (
                            <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#1e293b' }}>
                              Resolved Spec: <code style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px' }}>{matchResult.canonicalProductId}</code>
                            </div>
                          ) : (
                            <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#991b1b' }}>
                              Custom / Unrecognized Specification
                            </div>
                          )}
                          <div style={{ fontSize: '10.5px', color: '#64748b' }}>
                            {visual.assetTitle} ({visual.applicableStandard})
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {matchResult.clarificationReason ? (
                    <p style={{ margin: '6px 0 0', fontSize: '11.5px', color: '#92400e', lineHeight: 1.45 }}>
                      {matchResult.clarificationReason}
                    </p>
                  ) : (
                    <p style={{ margin: '6px 0 0', fontSize: '11.5px', color: '#166534', lineHeight: 1.45 }}>
                      Requirement conforms to Kovok verified canonical inventory conforming to {category === 'tmt_rebar' ? 'IS 1786:2008 Table 1' : 'IS 269:2015'}. No non-standard substitutions.
                    </p>
                  )}

                  {matchResult.advisoryEngineeringNote && (
                    <div style={{ marginTop: '8px', padding: '8px 10px', background: '#eff6ff', borderRadius: '6px', border: '1px solid #bfdbfe', fontSize: '11px', color: '#1e40af' }}>
                      <strong>Engineering Advisory:</strong> {matchResult.advisoryEngineeringNote}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Delivery & Sourcing */}
          {step === 2 && (
            <div>
              <div className="form-grid" style={{ marginBottom: '14px' }}>
                <div className="field">
                  <label>Delivery Project Site *</label>
                  <select
                    value={selectedSiteId}
                    onChange={(e) => setSelectedSiteId(e.target.value)}
                  >
                    {sites.length === 0 && <option value="">Loading project sites...</option>}
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.siteName} ({s.city} - {s.pinCode})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Delivery basis</label>
                  <select
                    value={deliveryBasis}
                    onChange={(e) => setDeliveryBasis(e.target.value)}
                  >
                    <option>Delivered at site (FOR Destination)</option>
                    <option>Ex-yard / buyer collects</option>
                    <option>Supplier delivery, unloading by buyer crane</option>
                  </select>
                </div>
              </div>

              {selectedSite && (
                <div className="panel" style={{ padding: '14px', fontSize: '11.5px', color: '#475569', marginBottom: '14px' }}>
                  <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: '4px' }}>
                    Destination Site Details:
                  </div>
                  <div><strong>Site Name:</strong> {selectedSite.siteName}</div>
                  <div><strong>Location:</strong> {selectedSite.city} · PIN Code: {selectedSite.pinCode}</div>
                  <div style={{ marginTop: '6px', color: '#64748b', fontSize: '10.5px' }}>
                    Note: Unloading restrictions and vehicle entry windows are verified against site rules.
                  </div>
                </div>
              )}

              <div
                style={{
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  padding: '12px',
                  borderRadius: '8px',
                  fontSize: '11px',
                  color: '#475569',
                }}
              >
                <strong>Supplier Sourcing Protocol:</strong> Regional supplier quotes will be gathered from authorized distributors within Delhi NCR. Live automated telephony calls via Sarvam AI voice agent will initiate within TRAI/DoT permitted hours (10:00 - 18:00 IST).
              </div>
            </div>
          )}

          {/* Step 3: Review & Send */}
          {step === 3 && (
            <div>
              {submissionResult ? (
                <div style={{ textAlign: 'center', padding: '24px 12px' }}>
                  <div
                    style={{
                      width: '52px',
                      height: '52px',
                      borderRadius: '50%',
                      background: submissionResult.match.requestStatus === 'MATCHED_VERIFIED' ? '#dcfce7' : '#fef3c7',
                      color: submissionResult.match.requestStatus === 'MATCHED_VERIFIED' ? '#15803d' : '#b45309',
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: '24px',
                      margin: '0 auto 14px',
                    }}
                  >
                    {submissionResult.match.requestStatus === 'MATCHED_VERIFIED' ? '✓' : '!'}
                  </div>
                  <h3 style={{ margin: '0 0 6px', fontSize: '18px' }}>
                    Request {submissionResult.request.requestCode} Created
                  </h3>
                  <p style={{ fontSize: '12.5px', color: '#475569', maxWidth: '440px', margin: '0 auto 16px' }}>
                    Status: <strong style={{ color: submissionResult.match.requestStatus === 'MATCHED_VERIFIED' ? '#15803d' : '#b45309' }}>
                      {submissionResult.match.requestStatus}
                    </strong>
                    {submissionResult.match.canonicalProductId && (
                      <span> · Matched to <code>{submissionResult.match.canonicalProductId}</code></span>
                    )}
                  </p>
                  {submissionResult.match.clarificationReason && (
                    <div className="alert" style={{ textAlign: 'left', marginBottom: '16px' }}>
                      <strong>Clarification Reason:</strong>
                      <br />
                      {submissionResult.match.clarificationReason}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                    <button className="btn btn-primary" onClick={onClose}>
                      View in Requests List →
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="alert" style={{ marginBottom: '14px' }}>
                    Review before submission. Kovok checks statutory standards and creates an isolated procurement intake record.
                  </div>

                  <div className="panel" style={{ padding: '16px', marginBottom: '16px' }}>
                    <div className="kv">
                      <span>Material Category</span>
                      <strong>{category === 'tmt_rebar' ? 'TMT Reinforcement Steel' : 'Cement & Binders'}</strong>
                    </div>
                    <div className="kv">
                      <span>Material Specification</span>
                      <strong>
                        {category === 'tmt_rebar'
                          ? `TMT Steel ${grade} · ${diameter} mm`
                          : `Cement ${cementType} · ${cementPack}`}
                      </strong>
                    </div>
                    <div className="kv">
                      <span>Catalogue Resolution</span>
                      <span className={`pill ${matchResult?.requestStatus === 'MATCHED_VERIFIED' ? 'green' : 'amber'}`}>
                        <span className="dot"></span>
                        {matchResult?.requestStatus === 'MATCHED_VERIFIED' ? 'Verified Match' : 'Clarification'}
                      </span>
                    </div>
                    {matchResult?.canonicalProductId && (
                      <div className="kv">
                        <span>Canonical Product ID</span>
                        <code>{matchResult.canonicalProductId}</code>
                      </div>
                    )}
                    <div className="kv">
                      <span>Quantity</span>
                      <strong>
                        {quantity} {unit}
                      </strong>
                    </div>
                    {conversion && conversion.totalPiecesEstimated && (
                      <div className="kv">
                        <span>Theoretical Conversion</span>
                        <span>{conversion.theoreticalBarsPerTonne} bars/tonne (~{conversion.totalPiecesEstimated} pieces)</span>
                      </div>
                    )}
                    <div className="kv">
                      <span>Destination Site</span>
                      <strong>
                        {selectedSite ? `${selectedSite.siteName} (${selectedSite.city} - ${selectedSite.pinCode})` : 'Unselected'}
                      </strong>
                    </div>
                    <div className="kv">
                      <span>Delivery Basis</span>
                      <strong>{deliveryBasis}</strong>
                    </div>
                    {buyerNotes && (
                      <div className="kv">
                        <span>Buyer Specifications</span>
                        <span>{buyerNotes}</span>
                      </div>
                    )}
                  </div>

                  <label className="checkline">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={(e) => setConfirmed(e.target.checked)}
                    />
                    <span>
                      I confirm this procurement specification. I understand Kovok will match to verified canonical specifications or flag for technical clarification without silent substitution.
                    </span>
                  </label>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {!submissionResult && (
          <div className="wizard-footer">
            <span style={{ fontSize: '10.5px', color: 'var(--muted)' }}>
              Step {step + 1} of 4 · Tenant-isolated procurement intake.
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              {step > 0 && (
                <button
                  className="btn btn-secondary"
                  disabled={isSubmitting}
                  onClick={() => setStep(step - 1)}
                >
                  Back
                </button>
              )}
              <button
                className="btn btn-primary"
                disabled={isSubmitting}
                onClick={handleNext}
              >
                {isSubmitting
                  ? 'Submitting...'
                  : step === 3
                  ? 'Submit Procurement Request'
                  : 'Continue →'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
