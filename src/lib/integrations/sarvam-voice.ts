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

export interface SarvamConnectionConfig {
  connection_id: string;
  agent_phone_number: string;
}

export interface SarvamAppConfig {
  app_id: string;
  app_version: number;
  connection_config: SarvamConnectionConfig;
}

export interface SarvamUserConfig {
  user_phone_number: string;
  request_code: string;
  supplier_name: string;
  material_specification: string;
  quantity: string;
  destination: string;
  quotation_fields_to_collect: string;
  material_spec?: string;
  unit?: string;
  delivery_city?: string;
  delivery_site_name?: string;
  delivery_pin_code?: string;
  [key: string]: string | undefined;
}

export interface SarvamWebhookConfig {
  url: string;
}

export interface SarvamOutboundPayload {
  app_config: SarvamAppConfig;
  user_config: SarvamUserConfig;
  webhook_config?: SarvamWebhookConfig;
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
 * Safely resolves Sarvam environment variable values with standard fallbacks
 * across Vercel production and local environments.
 */
export function getSarvamEnvValue(key: string): string | undefined {
  const direct = process.env[key];
  if (direct && direct.trim().length > 0) return direct.trim();

  switch (key) {
    case 'SARVAM_VOICE_WORKSPACE_API_KEY':
      return process.env.SARVAM_WORKSPACE_API_KEY?.trim();
    case 'SARVAM_WORKSPACE_ID':
      return (process.env['Workspace ID'] || process.env.SARVAM_WORKSPACE)?.trim();
    case 'SARVAM_ORG_ID':
      return (process.env['Organization ID'] || process.env.SARVAM_ORGANIZATION_ID)?.trim();
    case 'SARVAM_AGENT_APP_ID':
      return (process.env.SARVAM_APP_ID || process.env['Agent App ID'])?.trim();
    case 'SARVAM_AGENT_APP_VERSION':
      return (process.env.SARVAM_APP_VERSION || process.env['Agent App Version'])?.trim();
    case 'SARVAM_CONNECTION_ID':
      return (process.env['Connection ID'])?.trim();
    case 'SARVAM_AGENT_PHONE_NUMBER':
      return (process.env.SARVAM_PHONE_NUMBER || process.env.AGENT_PHONE_NUMBER || process.env['Agent Phone Number'])?.trim();
    case 'APP_BASE_URL':
      return (
        process.env.APP_URL ||
        (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined) ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined)
      )?.trim();
    default:
      return undefined;
  }
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
    const val = getSarvamEnvValue(key);
    if (!val || val.length === 0) {
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
 * Checks whether a phone number is a valid Indian mobile number (10 digits starting with 6-9,
 * with optional +91 or 91 country code prefix).
 */
export function isValidIndianPhone(phone: string | null | undefined): boolean {
  if (!phone) return false;
  const cleaned = phone.replace(/[\s\-()]/g, '');
  return /^(?:\+91|91)?[6-9]\d{9}$/.test(cleaned);
}

/**
 * Checks whether an agent caller ID phone number is a valid Indian number (mobile or landline/DID,
 * 10 digits with optional +91 or 91 country code prefix).
 */
export function isValidAgentCallerPhone(phone: string | null | undefined): boolean {
  if (!phone) return false;
  const cleaned = phone.replace(/[\s\-()]/g, '');
  return /^(?:\+91|91)?[1-9]\d{9}$/.test(cleaned);
}

/**
 * Normalizes an Indian telephone number to strict E.164 format (+91XXXXXXXXXX).
 */
export function formatE164IndianPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  }
  if (phone.startsWith('+')) {
    return `+${digits}`;
  }
  return `+${digits}`;
}

/**
 * Masks a phone number for secure logging and display without leaking digits.
 * E.g. "+919876543210" -> "+91******3210", "9876543210" -> "******3210"
 */
export function maskPhoneNumber(phone: string | null | undefined): string {
  if (!phone || !phone.trim()) return '[REDACTED]';
  const cleaned = phone.trim();
  if (cleaned.length < 7) return '***';
  const lastFour = cleaned.slice(-4);
  const prefix = cleaned.startsWith('+91') ? '+91' : cleaned.startsWith('+') ? cleaned.slice(0, 3) : '';
  const maskedLength = Math.max(3, cleaned.length - prefix.length - 4);
  return `${prefix}${'*'.repeat(maskedLength)}${lastFour}`;
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
 * Builds and validates the strict Sarvam Voice Agents Instant Outbound payload.
 * Conforms to the official Sarvam FastAPI/Pydantic schema:
 *   - app_config (app_id, integer app_version, connection_config)
 *   - user_config (user_phone_number E.164, request_code, material_specification, quantity, destination, quotation_fields_to_collect)
 *   - webhook_config (optional callback url)
 *
 * CRITICAL PRIVACY & SECURITY INVARIANT:
 * Omits internal buyer IDs (userId, workspaceId, procurementRequestId, supplierId)
 * and internal margins/budget.
 */
export function buildSarvamOutboundPayload(
  payload: OutboundCallPayload,
  callbackUrl?: string
): SarvamOutboundPayload {
  // Input validation
  if (!payload.requestCode || !payload.requestCode.trim()) {
    throw new Error('Missing required procurement request code');
  }
  if (!payload.materialSpecification || !payload.materialSpecification.trim()) {
    throw new Error('Missing required material specification');
  }
  if (typeof payload.targetQuantity !== 'number' || isNaN(payload.targetQuantity) || payload.targetQuantity <= 0) {
    throw new Error(`Invalid target quantity: ${payload.targetQuantity}. Must be a positive number.`);
  }
  if (!payload.quantityUnit || !payload.quantityUnit.trim()) {
    throw new Error('Missing required quantity unit');
  }
  if (!payload.deliveryCity || !payload.deliveryCity.trim()) {
    throw new Error('Missing required delivery city');
  }
  if (!isValidIndianPhone(payload.supplierPhone)) {
    throw new Error(`Invalid Indian supplier telephone number: '${maskPhoneNumber(payload.supplierPhone)}'. Must be 10 digits starting with 6-9.`);
  }

  // App & Connection environment validation
  const appId = getSarvamEnvValue('SARVAM_AGENT_APP_ID');
  if (!appId) {
    throw new Error('Missing SARVAM_AGENT_APP_ID configuration');
  }

  const rawVersion = getSarvamEnvValue('SARVAM_AGENT_APP_VERSION') || '1';
  const parsedVersion = parseInt(rawVersion.replace(/^[^\d]*/, ''), 10);
  const appVersion = Number.isInteger(parsedVersion) && parsedVersion > 0 ? parsedVersion : 1;

  const connectionId = getSarvamEnvValue('SARVAM_CONNECTION_ID');
  if (!connectionId) {
    throw new Error('Missing SARVAM_CONNECTION_ID configuration');
  }

  const rawAgentPhone = getSarvamEnvValue('SARVAM_AGENT_PHONE_NUMBER');
  if (!rawAgentPhone || !isValidAgentCallerPhone(rawAgentPhone)) {
    throw new Error('Missing or invalid SARVAM_AGENT_PHONE_NUMBER configuration');
  }

  const destinationParts = [
    payload.deliverySiteName?.trim(),
    payload.deliveryCity.trim(),
    payload.deliveryPinCode?.trim() ? `PIN ${payload.deliveryPinCode.trim()}` : '',
  ]
    .filter(Boolean)
    .join(', ');

  const outboundPayload: SarvamOutboundPayload = {
    app_config: {
      app_id: appId,
      app_version: appVersion,
      connection_config: {
        connection_id: connectionId,
        agent_phone_number: formatE164IndianPhone(rawAgentPhone),
      },
    },
    user_config: {
      user_phone_number: formatE164IndianPhone(payload.supplierPhone),
      request_code: payload.requestCode.trim(),
      supplier_name: payload.supplierName.trim(),
      material_specification: payload.materialSpecification.trim(),
      quantity: `${payload.targetQuantity} ${payload.quantityUnit.trim()}`,
      destination: destinationParts,
      quotation_fields_to_collect: 'basic_rate_per_unit, gst_rate_pct, freight_charges, unloading_charges, payment_terms, delivery_lead_time_days, quotation_validity_days',
      // Compatibility aliases matching prompt templates
      material_spec: payload.materialSpecification.trim(),
      unit: payload.quantityUnit.trim(),
      delivery_city: payload.deliveryCity.trim(),
      delivery_site_name: payload.deliverySiteName?.trim() || '',
      delivery_pin_code: payload.deliveryPinCode?.trim() || '',
    },
    ...(callbackUrl ? { webhook_config: { url: callbackUrl } } : {}),
  };

  return outboundPayload;
}

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
  maskedRecipientPhone?: string;
}> {
  const config = getSarvamVoiceConfigStatus();
  const { token, tokenHash } = generateCallbackToken();
  const maskedPhone = maskPhoneNumber(payload.supplierPhone);

  if (!config.isConfigured) {
    return {
      success: false,
      status: 'CONFIGURATION_INCOMPLETE',
      callbackToken: token,
      callbackTokenHash: tokenHash,
      error: `Sarvam Voice configuration is incomplete. Missing: ${config.missingVariables.join(', ')}`,
      missingConfig: config.missingVariables,
      maskedRecipientPhone: maskedPhone,
    };
  }

  const baseUrl = (getSarvamEnvValue('APP_BASE_URL') || 'http://localhost:3000').replace(/\/$/, '');
  const callbackUrl = `${baseUrl}/api/integrations/sarvam/webhook?call_token=${token}&request_code=${encodeURIComponent(payload.requestCode)}`;

  let requestBody: SarvamOutboundPayload;
  try {
    requestBody = buildSarvamOutboundPayload(payload, callbackUrl);
  } catch (err: any) {
    return {
      success: false,
      status: 'INVALID_PAYLOAD',
      callbackToken: token,
      callbackTokenHash: tokenHash,
      error: `Validation error: ${err.message || String(err)}`,
      maskedRecipientPhone: maskedPhone,
    };
  }

  const orgId = getSarvamEnvValue('SARVAM_ORG_ID')!;
  const workspaceId = getSarvamEnvValue('SARVAM_WORKSPACE_ID')!;
  const apiKey = getSarvamEnvValue('SARVAM_VOICE_WORKSPACE_API_KEY')!;
  const endpoint = `https://apps.sarvam.ai/api/outbounds/v1/orgs/${encodeURIComponent(orgId)}/workspaces/${encodeURIComponent(workspaceId)}/outbounds`;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      const errText = await res.text();
      // Sanitize any potential phone numbers or sensitive content in error output
      const sanitizedErr = errText
        .replace(/(?:\+91|91)?[6-9]\d{9}/g, (match) => maskPhoneNumber(match))
        .slice(0, 300);

      return {
        success: false,
        status: `API_ERROR_${res.status}`,
        callbackToken: token,
        callbackTokenHash: tokenHash,
        error: `Sarvam outbound gateway responded with HTTP ${res.status}: ${sanitizedErr}`,
        maskedRecipientPhone: maskedPhone,
      };
    }

    const data = await res.json();
    return {
      success: true,
      status: 'QUEUED',
      attemptId: data.attempt_id || data.id || `ATT-${Date.now()}`,
      callbackToken: token,
      callbackTokenHash: tokenHash,
      maskedRecipientPhone: maskedPhone,
    };
  } catch (err: any) {
    return {
      success: false,
      status: 'GATEWAY_ERROR',
      callbackToken: token,
      callbackTokenHash: tokenHash,
      error: `Network/Gateway error connecting to Sarvam Voice API: ${err.message || String(err)}`,
      maskedRecipientPhone: maskedPhone,
    };
  }
}
