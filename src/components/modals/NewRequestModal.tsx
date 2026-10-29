'use client';

import React, { useState } from 'react';

interface NewRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (requestData: any) => void;
}

export function NewRequestModal({ isOpen, onClose, onSubmit }: NewRequestModalProps) {
  const [step, setStep] = useState(0);
  const [category, setCategory] = useState<'tmt' | 'cement' | 'other'>('tmt');
  const [description, setDescription] = useState('20 tonnes of TMT steel for Gurugram site');
  const [grade, setGrade] = useState('Fe 550D');
  const [diameter, setDiameter] = useState('12');
  const [brandRule, setBrandRule] = useState('Open to approved brands');
  const [cementType, setCementType] = useState('OPC 53');
  const [cementPack, setCementPack] = useState('50 kg bag');
  const [quantity, setQuantity] = useState('20');
  const [unit, setUnit] = useState('tonnes');
  const [site, setSite] = useState('Site A — Gurugram');
  const [pin, setPin] = useState('122018');
  const [date, setDate] = useState('2026-11-02');
  const [deliveryBasis, setDeliveryBasis] = useState('Delivered at site');
  const [vendorCount, setVendorCount] = useState('3');
  const [budget, setBudget] = useState('₹10,50,000');
  const [confirmed, setConfirmed] = useState(false);

  if (!isOpen) return null;

  const titles = ['What do you need?', 'Identify the material', 'Delivery & sourcing', 'Review and send'];
  const captions = [
    'Describe it in your own words. Kovok will ask for the missing details.',
    'Confirm the attributes that make this the correct product.',
    'Tell Kovok where and when it is needed.',
    'Check all details before supplier outreach starts.',
  ];

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      if (!confirmed) {
        alert('Please confirm the requirement before submitting.');
        return;
      }
      onSubmit({
        category,
        description,
        grade,
        diameter,
        quantity,
        unit,
        site,
        pin,
        date,
        deliveryBasis,
        vendorCount,
      });
      onClose();
    }
  };

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
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
                  ♫
                </div>
                <div>
                  <strong style={{ fontSize: '12px' }}>Describe it naturally</strong>
                  <p style={{ fontSize: '11px', color: '#64748b', margin: '4px 0 0' }}>
                    Type the request or use speech. In production, Sarvam handles voice; Kovok resolves the product and business rules.
                  </p>
                </div>
              </div>

              <div className="field" style={{ marginBottom: '14px' }}>
                <label>What do you need?</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. 20 tonnes of TMT steel for Gurugram site by Monday..."
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
                      setUnit(c === 'cement' ? 'bags' : 'tonnes');
                    }}
                  >
                    <option value="tmt">TMT / reinforcement steel</option>
                    <option value="cement">Cement</option>
                    <option value="other">Other construction material</option>
                  </select>
                </div>
                <div className="field">
                  <label>Request source</label>
                  <select>
                    <option>New standalone request</option>
                    <option>Existing system / purchase request</option>
                    <option>Repeat previous purchase</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Identify */}
          {step === 1 && (
            <div>
              <div className="alert" style={{ marginBottom: '14px' }}>
                Only required attributes for the selected material should be mandatory. An image can help identify a product, but cannot prove structural compliance.
              </div>

              {category === 'tmt' ? (
                <div className="form-grid three" style={{ marginBottom: '14px' }}>
                  <div className="field">
                    <label>Grade / designation *</label>
                    <select value={grade} onChange={(e) => setGrade(e.target.value)}>
                      <option>Fe 500D</option>
                      <option>Fe 550D</option>
                      <option>Fe 500</option>
                      <option>Fe 415D</option>
                      <option>Fe 600</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Diameter (mm) *</label>
                    <select value={diameter} onChange={(e) => setDiameter(e.target.value)}>
                      <option>8</option>
                      <option>10</option>
                      <option>12</option>
                      <option>16</option>
                      <option>20</option>
                      <option>25</option>
                      <option>32</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Brand / mill rule</label>
                    <select value={brandRule} onChange={(e) => setBrandRule(e.target.value)}>
                      <option>Open to approved brands</option>
                      <option>Specific approved brand only</option>
                      <option>Buyer must approve alternatives</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div className="form-grid three" style={{ marginBottom: '14px' }}>
                  <div className="field">
                    <label>Cement type *</label>
                    <select value={cementType} onChange={(e) => setCementType(e.target.value)}>
                      <option>OPC 53</option>
                      <option>OPC 43</option>
                      <option>PPC (Flyash)</option>
                      <option>PSC (Slag)</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Pack size *</label>
                    <select value={cementPack} onChange={(e) => setCementPack(e.target.value)}>
                      <option>50 kg bag</option>
                      <option>Bulk tanker</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Brand rule</label>
                    <select>
                      <option>Open to approved brands</option>
                      <option>Specific approved brand only</option>
                    </select>
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
                  <label>Unit *</label>
                  <select value={unit} onChange={(e) => setUnit(e.target.value)}>
                    <option>tonnes</option>
                    <option>bags</option>
                    <option>kg</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Delivery & Sourcing */}
          {step === 2 && (
            <div>
              <div className="form-grid" style={{ marginBottom: '14px' }}>
                <div className="field">
                  <label>Delivery site / project *</label>
                  <input value={site} onChange={(e) => setSite(e.target.value)} />
                </div>
                <div className="field">
                  <label>PIN code *</label>
                  <input
                    value={pin}
                    maxLength={6}
                    onChange={(e) => setPin(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Required by date *</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Delivery basis</label>
                  <select
                    value={deliveryBasis}
                    onChange={(e) => setDeliveryBasis(e.target.value)}
                  >
                    <option>Delivered at site</option>
                    <option>Ex-yard / buyer collects</option>
                    <option>Supplier delivery, unloading by buyer</option>
                  </select>
                </div>
              </div>

              <div className="field" style={{ marginBottom: '14px' }}>
                <label>Budget or ceiling cost (optional)</label>
                <input
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="e.g. ₹10,50,000"
                />
              </div>
            </div>
          )}

          {/* Step 3: Review & Send */}
          {step === 3 && (
            <div>
              <div className="alert" style={{ marginBottom: '14px' }}>
                Review before any supplier outreach starts. The system will use these exact terms to request comparable offers. No order is placed at this stage.
              </div>

              <div className="panel" style={{ padding: '16px', marginBottom: '16px' }}>
                <div className="kv">
                  <span>Material & Grade</span>
                  <strong>
                    {category === 'tmt' ? `TMT Steel ${grade} · ${diameter} mm` : `Cement ${cementType} · ${cementPack}`}
                  </strong>
                </div>
                <div className="kv">
                  <span>Quantity</span>
                  <strong>
                    {quantity} {unit}
                  </strong>
                </div>
                <div className="kv">
                  <span>Delivery destination</span>
                  <strong>
                    {site} · {pin}
                  </strong>
                </div>
                <div className="kv">
                  <span>Required by</span>
                  <strong>{date}</strong>
                </div>
                <div className="kv">
                  <span>Delivery basis</span>
                  <strong>{deliveryBasis}</strong>
                </div>
              </div>

              <label className="checkline">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                <span>
                  I confirm the requirement is accurate and authorize Kovok to contact eligible suppliers for quotations. This does not authorize an order.
                </span>
              </label>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="wizard-footer">
          <span style={{ fontSize: '10.5px', color: 'var(--muted)' }}>
            Step {step + 1} of 4 · Buyer authorization strictly required before order placement.
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            {step > 0 && (
              <button className="btn btn-secondary" onClick={() => setStep(step - 1)}>
                Back
              </button>
            )}
            <button className="btn btn-primary" onClick={handleNext}>
              {step === 3 ? 'Create request & start sourcing' : 'Continue →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
