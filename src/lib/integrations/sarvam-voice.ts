/**
 * Kovok Construction Procurement Operations Platform
 * Sarvam AI Voice Telephony Gateway (Samvaad Outbound API)
 *
 * Implements server-only voice call orchestration, configuration validation,
 * cryptographic callback token verification, structured extraction parsing,
 * and draft quotation generation.
 *
 * CRITICAL SECURITY INVARIANT:
 * Never print, reveal, or log .env values, API keys, tokens, or authorization headers.
 */

import * as crypto from 'crypto';

export interface SarvamVoiceConfigStatus {
  isConfigured: boolean;
  status: 'NOT_CONFIGURED' | 'CONFIG_INCOMPLETE' | 'CONFIGURED';
  missingVariables: string[];
  configuredVariables: string[];
}

export interface OutboundCallPayload {
  workspaceId: string;
  procurementRequestId: string;
  requestCode: string;
  supplierId: string;
  supplierName: string;
  supplierPhone: string;
  materialSpecification: string;
  targetQuantity: number;
  quantityUnit: string;
  deliverySiteName: string;
  deliveryCity: string;
  deliveryPinCode: string;
  initiatedByUserId: string;
}

export interface ExtractedVoiceVariables {
  call_outcome?: 'SUCCESS_QUOTED' | 'OUT_OF_STOCK' | 'BUSY_UNREACHABLE' | 'REFUSED_QUOTE' | 'WRONG_CONTACT' | 'FOLLOW_UP_REQUESTED';
  supplier_name_confirmed?: string;
  contact_name?: string;
  product_match_confirmed?: boolean;
  brand?: string;
  grade?: string;
  specification_match?: string;
  quoted_rate?: number;
  quoted_unit?: string;
  gst_rate?: number;
  freight_amount?: number;
  unloading_amount?: number;
  available_quantity?: number;
  minimum_order_quantity?: number;
  delivery_lead_time?: string;
  payment_terms?: string;
  quotation_validity?: string;
  clarifications?: string;
  follow_up_required?: boolean;
}

/**
 * Validates whether Sarvam Voice environment variables are configured.
 * Never prints or returns the values of secret variables.
 */
export function getSarvamVoiceConfigStatus(): SarvamVoiceConfigStatus {
  const requiredKeys = [
    'SARVAM_VOICE_WORKSPACE_API_KEY',
    'SARVAM_ORG_ID',
    'SARVAM_WORKSPACE_ID',
    'SARVAM_AGENT_APP_ID',
    'SARVAM_AGENT_APP_VERSION',
    'SARVAM_CONNECTION_ID',
    'SARVAM_AGENT_PHONE_NUMBER',
    'APP_BASE_URL',
  ];

  const missing: string[] = [];
  const configured: string[] = [];

  for (const key of requiredKeys) {
    const val = process.env[key];
    if (!val || val.trim().length === 0) {
      missing.push(key);
    } else {
      configured.push(key);
    }
  }

  // Model API check (separate from voice workspace API)
  const hasModelApiKey = Boolean(process.env.SARVAM_API_KEY && process.env.SARVAM_API_KEY.trim());
  if (hasModelApiKey) {
    configured.push('SARVAM_API_KEY (Model API)');
  }

  if (missing.length === requiredKeys.length) {
    return {
      isConfigured: false,
      status: 'NOT_CONFIGURED',
      missingVariables: missing,
      configuredVariables: configured,
    };
  }

  if (missing.length > 0) {
    return {
      isConfigured: false,
      status: 'CONFIG_INCOMPLETE',
      missingVariables: missing,
      configuredVariables: configured,
    };
  }

  return {
    isConfigured: true,
    status: 'CONFIGURED',
    missingVariables: [],
    configuredVariables: configured,
  };
}

/**
 * Generates a high-entropy per-call callback token and returns both the plaintext
 * token (to be sent in webhook query parameter) and its SHA-256 hash (stored in DB).
 */
export function generateCallbackToken(): { token: string; tokenHash: string } {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, tokenHash };
}

/**
 * Constant-time verification of a callback token against a stored hash.
 */
export function verifyCallbackToken(token: string, expectedHash: string): boolean {
  if (!token || !expectedHash) return false;
  const computedHash = crypto.createHash('sha256').update(token).digest('hex');
  const bufA = Buffer.from(computedHash, 'hex');
  const bufB = Buffer.from(expectedHash, 'hex');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Standardized system prompt for Kovok Voice Quotation Collection Agent.
 */
export const SARVAM_SUPPLIER_AGENT_PROMPT = `
You are 'Aarav', a professional construction procurement assistant calling on behalf of Kovok Construction Platform.
Your goal is to gather a commercial rate quotation from a verified building materials supplier.

LANGUAGE & TONE:
- Speak in professional, courteous, natural Hindi mixed with standard Indian English construction terms (code-switch naturally e.g. "Namaste ji, main Kovok procurement se bol raha hoon...").
- Keep sentences concise, clear, and business-focused.
- Maintain an industrial, professional tone.

STEP-BY-STEP CONVERSATION FLOW:
1. GREETING & CONTACT CONFIRMATION:
   "Namaste, kya meri baat {supplier_name} ke sales team ya authorized dispatch manager se ho rahi hai?"
   If wrong contact or unavailable, ask for the right person or best callback time, then close politely.

2. SPECIFICATION STATEMENT:
   "Humare project client ko {delivery_city} site ke liye {quantity} {unit} of {material_spec} ki requirement hai. Target delivery {target_date} tak expected hai."
   "Kya aapke paas yeh material currently available ya rolling cycle mein hai?"

3. RATE & COMMERCIAL TERMS COLLECTION:
   If available, systematically collect the key commercial variables:
   a. Base Material Rate: "Aapka per {unit} basic rate kya hoga (excluding GST)?"
   b. GST: "Ispe standard GST rate kitna lagega (18% / applicable)?"
   c. Freight / Transport: "Site delivered delivery ({delivery_site_name}, PIN {delivery_pin_code}) ke liye freight kitna hoga, ya rate basic ex-factory hai?"
   d. Unloading / Crane: "Site pe unloading charges include hain ya extra?"
   e. MOQ & Availability: "Kitni quantity immediately dispatch ho sakti hai? Minimum order quantity kitna hai?"
   f. Lead Time & Validity: "Order confirm hone ke baad delivery kitne din mein pahunchegi? Aur yeh quotation kitne din tak valid rahegi?"
   g. Payment Terms: "Standard payment terms kya rahenge (advance, 30-day credit, PDC, LC)?"

4. CONFIRMATION & VERIFICATION:
   - Repeat all key numbers clearly to the supplier: "Main confirm kar leta hoon: Rate {quoted_rate} per {unit}, GST {gst_rate}%, freight {freight_amount}, and delivery in {delivery_lead_time} days. Correct hai?"

5. STRICT BUSINESS INVARIANTS:
   - NEVER approve a purchase or commit the buyer to an order.
   - NEVER negotiate beyond recording the supplier's stated price.
   - If a supplier doesn't know freight or unloading, explicitly record it as 'unknown/not confirmed'.
   - Thank them professionally and close: "Bahut shukriya aapka time dene ke liye. Humari procurement team quote review karke portal ke through update karegi. Namaste."
`.trim();

/**
 * Executes server-side outbound call to Sarvam Voice Agents API.
 * Returns attempt information or throws structured validation error.
 */
export async function initiateSarvamOutboundCall(payload: OutboundCallPayload): Promise<{
  success: boolean;
  attemptId?: string;
  status: string;
  callbackToken: string;
  callbackTokenHash: string;
  error?: string;
  missingConfig?: string[];
}> {
  const config = getSarvamVoiceConfigStatus();
  const { token, tokenHash } = generateCallbackToken();

  if (!config.isConfigured) {
    return {
      success: false,
      status: 'CONFIGURATION_INCOMPLETE',
      callbackToken: token,
      callbackTokenHash: tokenHash,
      error: `Sarvam Voice configuration is incomplete. Missing: ${config.missingVariables.join(', ')}`,
      missingConfig: config.missingVariables,
    };
  }

  // Validate phone number format (E.164 or 10-digit Indian mobile)
  const phoneClean = payload.supplierPhone.replace(/[\s\-()]/g, '');
  const isValidPhone = /^(?:\+91|91)?[6-9]\d{9}$/.test(phoneClean);
  if (!isValidPhone) {
    return {
      success: false,
      status: 'INVALID_PHONE_NUMBER',
      callbackToken: token,
      callbackTokenHash: tokenHash,
      error: `Invalid Indian supplier telephone number: '${payload.supplierPhone}'. Must be 10 digits starting with 6-9.`,
    };
  }

  const orgId = process.env.SARVAM_ORG_ID!;
  const workspaceId = process.env.SARVAM_WORKSPACE_ID!;
  const endpoint = `https://apps.sarvam.ai/api/outbounds/v1/orgs/${encodeURIComponent(orgId)}/workspaces/${encodeURIComponent(workspaceId)}/outbounds`;

  const baseUrl = process.env.APP_BASE_URL?.replace(/\/$/, '') || 'http://localhost:3000';
  const callbackUrl = `${baseUrl}/api/integrations/sarvam/webhook?call_token=${token}&request_code=${encodeURIComponent(payload.requestCode)}`;

  const requestBody = {
    app_id: process.env.SARVAM_AGENT_APP_ID,
    app_version: process.env.SARVAM_AGENT_APP_VERSION,
    connection_id: process.env.SARVAM_CONNECTION_ID,
    agent_phone_number: process.env.SARVAM_AGENT_PHONE_NUMBER,
    user_phone_number: phoneClean.startsWith('+') ? phoneClean : phoneClean.length === 10 ? `+91${phoneClean}` : `+${phoneClean}`,
    callback_url: callbackUrl,
    custom_variables: {
      request_code: payload.requestCode,
      supplier_name: payload.supplierName,
      material_spec: payload.materialSpecification,
      quantity: String(payload.targetQuantity),
      unit: payload.quantityUnit,
      delivery_site_name: payload.deliverySiteName,
      delivery_city: payload.deliveryCity,
      delivery_pin_code: payload.deliveryPinCode,
    },
  };

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.SARVAM_VOICE_WORKSPACE_API_KEY!,
      },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        success: false,
        status: `API_ERROR_${res.status}`,
        callbackToken: token,
        callbackTokenHash: tokenHash,
        error: `Sarvam outbound gateway responded with HTTP ${res.status}: ${errText.slice(0, 300)}`,
      };
    }

    const data = await res.json();
    return {
      success: true,
      status: 'QUEUED',
      attemptId: data.attempt_id || data.id || `ATT-${Date.now()}`,
      callbackToken: token,
      callbackTokenHash: tokenHash,
    };
  } catch (err: any) {
    return {
      success: false,
      status: 'GATEWAY_ERROR',
      callbackToken: token,
      callbackTokenHash: tokenHash,
      error: `Network/Gateway error connecting to Sarvam Voice API: ${err.message || String(err)}`,
    };
  }
}

