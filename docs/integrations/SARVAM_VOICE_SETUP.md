# Kovok — Sarvam AI Voice Agent (Samvaad) Telephony Integration Guide

This guide details the end-to-end setup and production configuration for Kovok's automated supplier quotation collection using **Sarvam Voice Agents (Samvaad)**.

---

## 1. Architectural Overview & Security Invariant

Kovok uses Sarvam's outbound telephony infrastructure to initiate conversational phone calls with verified construction material suppliers.

```
┌───────────────────────────┐         Outbound API (X-API-Key)         ┌──────────────────────────┐
│  Kovok Procurement Engine │ ───────────────────────────────────────> │  Sarvam Voice Platform   │
│  (Next.js 16 + PostgreSQL)│                                          │  (Samvaad Orchestrator)  │
└───────────────────────────┘                                          └──────────────────────────┘
              ▲                                                                      │
              │                                                                      │ PSTN SIP Trunk
              │                                                                      ▼
              │ Webhook Callback (HMAC / Token Auth)                   ┌──────────────────────────┐
              └─────────────────────────────────────────────────────── │ Building Material Vendor │
                                                                       │ (Phone Conversation)     │
                                                                       └──────────────────────────┘
```

### Strict Security & Commercial Invariants
1. **Model API vs. Voice Workspace API:** The `SARVAM_API_KEY` used for chat/LLM completions is **NOT** interchangeable with the Voice Agent workspace API key. The voice outbound endpoint requires an organization/workspace credential passed in the `X-API-Key` HTTP header.
2. **Gated Buyer Approval:** Telephony calls only generate draft quotations marked **`PENDING_REVIEW`**. The voice agent cannot commit purchases or place orders under any circumstances.
3. **Sensitive Data Protection:** Phone numbers, transcripts, and API keys are protected. Keys are server-only and never rendered in client bundles or logged.

---

## 2. Prerequisites & Sarvam Console Setup

1. **Sarvam Enterprise Account:**
   - Sign up and log in to [Sarvam AI Console](https://apps.sarvam.ai/).
   - Obtain your **Organization ID** (`org_id`) and **Workspace ID** (`workspace_id`).

2. **Create Voice Agent Application:**
   - In the Sarvam Console, navigate to **Voice Agents / Apps**.
   - Click **Create New Voice Agent**.
   - Set Name: `Kovok-Construction-Quotation-Agent`.
   - Select Language: **Hindi + English (Indian Code-Switch / Hinglish)**.
   - Select Base Model: `sarvam-2b` or `sarvam-105b` with conversational voice latency optimizations.
   - Note the **`app_id`** and **`app_version`** (e.g., `1.0.0`).

3. **Telephony Connection & Virtual Number:**
   - Under **Telephony & Connections**, provision or bind an Indian DID (Direct Inward Dialing) phone number with outbound calling capability (e.g. `+9111XXXXXXXX`).
   - Copy the **`connection_id`** and **`agent_phone_number`**.

---

## 3. Agent Prompt & Variable Configuration

In the Sarvam Agent Configuration editor, configure the system prompt and structured extraction variables.

### System Prompt
```
You are 'Aarav', a professional construction procurement assistant calling on behalf of Kovok Construction Platform.
Your goal is to gather a commercial rate quotation from a verified building materials supplier.

LANGUAGE & TONE:
- Speak in professional, courteous, natural Hindi mixed with standard Indian English construction terms.
- Keep sentences concise, clear, and business-focused.

STEP-BY-STEP CONVERSATION FLOW:
1. GREETING & CONTACT CONFIRMATION:
   "Namaste, kya meri baat {supplier_name} ke sales team ya authorized dispatch manager se ho rahi hai?"
   If wrong contact or unavailable, ask for the right person or best callback time, then close politely.

2. SPECIFICATION STATEMENT:
   "Humare project client ko {delivery_city} site ke liye {quantity} {unit} of {material_spec} ki requirement hai. Target delivery {target_date} tak expected hai."
   "Kya aapke paas yeh material currently available ya rolling cycle mein hai?"

3. RATE & COMMERCIAL TERMS COLLECTION:
   a. Base Material Rate: "Aapka per {unit} basic rate kya hoga (excluding GST)?"
   b. GST: "Ispe standard GST rate kitna lagega (18% / applicable)?"
   c. Freight / Transport: "Site delivered delivery ({delivery_site_name}, PIN {delivery_pin_code}) ke liye freight kitna hoga, ya rate basic ex-factory hai?"
   d. Unloading / Crane: "Site pe unloading charges include hain ya extra?"
   e. MOQ & Availability: "Kitni quantity immediately dispatch ho sakti hai? Minimum order quantity kitna hai?"
   f. Lead Time & Validity: "Order confirm hone ke baad delivery kitne din mein pahunchegi? Aur yeh quotation kitne din tak valid rahegi?"
   g. Payment Terms: "Standard payment terms kya rahenge (advance, 30-day credit, PDC, LC)?"

4. CONFIRMATION & VERIFICATION:
   - Repeat all key numbers clearly to the supplier: "Main confirm kar leta hoon: Rate {quoted_rate} per {unit}, GST {gst_rate}%, freight {freight_amount}, and delivery in {delivery_lead_time} days. Correct hai?"

5. STRICT INVARIANTS:
   - NEVER approve a purchase or commit the buyer to an order.
   - If a supplier doesn't know freight or unloading, explicitly record it as 'unknown/not confirmed'.
   - Thank them professionally and close.
```

### Structured Extraction Schema (Agent Variables)

| Variable Key | Type | Description |
| :--- | :--- | :--- |
| `call_outcome` | String | `SUCCESS_QUOTED`, `OUT_OF_STOCK`, `BUSY_UNREACHABLE`, `REFUSED_QUOTE`, `WRONG_CONTACT` |
| `supplier_name_confirmed` | String | Confirmed name of the supplier dealership |
| `contact_name` | String | Name of the person who answered |
| `product_match_confirmed` | Boolean | True if conforming product is in stock or rolling |
| `brand` | String | Brand quoted (e.g. JSW, Tata Tiscon, Jindal, UltraTech) |
| `grade` | String | Grade quoted (e.g. Fe 500D, Fe 550D, OPC 53) |
| `quoted_rate` | Number | Quoted base rate per unit (ex-factory or basic) |
| `quoted_unit` | String | `TONNE`, `KG`, `BAG`, `PIECE` |
| `gst_rate` | Number | Applicable GST percentage (e.g. 18.0) |
| `freight_amount` | Number | Stated freight charges to site (0 if included or unknown) |
| `unloading_amount` | Number | Stated unloading charges at site (0 if included or unknown) |
| `available_quantity` | Number | Quantity available for immediate dispatch |
| `minimum_order_quantity` | Number | Minimum order threshold |
| `delivery_lead_time` | String | ETA e.g. "Tomorrow 10 AM", "3 days" |
| `payment_terms` | String | e.g. "Advance RTGS", "30 days net", "Cash on delivery" |
| `quotation_validity` | String | e.g. "Valid for 24 hours", "Valid today only" |
| `clarifications` | String | Any non-standard observations or rolling cycle constraints |
| `follow_up_required` | Boolean | True if supplier asked for callback |

---

## 4. Environment Configuration

Add the following environment variables to your `.env` (or `.env.local` for development).

```env
# ------------------------------------------------------------------------------
# SARVAM VOICE AGENTS (SAMVAAD) TELEPHONY GATEWAY
# ------------------------------------------------------------------------------
SARVAM_VOICE_WORKSPACE_API_KEY=your_voice_workspace_api_key_here
SARVAM_ORG_ID=your_org_id_here
SARVAM_WORKSPACE_ID=your_workspace_id_here
SARVAM_AGENT_APP_ID=your_agent_app_id_here
SARVAM_AGENT_APP_VERSION=1.0.0
SARVAM_CONNECTION_ID=your_telephony_connection_id_here
SARVAM_AGENT_PHONE_NUMBER=+9111XXXXXXXX
APP_BASE_URL=https://your-domain.kovok.in
SARVAM_WEBHOOK_SECRET=your_high_entropy_webhook_secret_here

# Model API Key (Used separately for LLM parsing tests)
SARVAM_API_KEY=your_model_api_subscription_key_here
```

> **Notice:** If any of the above variables are missing, Kovok's UI displays the integration state as **`CONFIG_INCOMPLETE`** or **`NOT_CONFIGURED`**, and outbound calls are safely inhibited.

---

## 5. Webhook & Callback Specification

### Endpoint:
`POST /api/integrations/sarvam/webhook`

### Query Parameter Authentication:
Each call generated by Kovok includes a high-entropy, per-call token:
`?call_token=<64-char-hex>&request_code=<request-code>`

When the webhook fires:
1. The server checks the constant-time hash of `call_token` against the `callbackTokenHash` saved in the database record.
2. Webhook payload shape is validated.
3. Call attempt ID, interaction ID, duration, and status are recorded in `supplier_voice_calls`.
4. If commercial terms were collected (`quoted_rate > 0`), an idempotent draft quotation is created in `quotations` with status:
   **`PENDING_REVIEW`**.
5. Repeated webhook delivery is idempotent: duplicate quotations are never inserted.

---

## 6. End-to-End Verification Procedure

1. **Check System Diagnostics:**
   Navigate to the **Integrations** tab in Kovok. Inspect the **Sarvam AI Voice Telephony Gateway** card:
   - If green (**Connected**), all required variables are verified.
   - If amber (**Configuration Incomplete**), click **Telephony Specs** to view which variables are missing.

2. **Trigger Outbound Call from Request:**
   - In **Requests**, open a procurement intake record (e.g. `KOV-REQ-0001`).
   - Click **Initiate Supplier Voice Call**.
   - Select a verified supplier (e.g. Shakti Steel & Co.) and check the supplier phone number.
   - Review the call scope confirmation modal and click **Confirm & Place Call**.

3. **Verify Database Records:**
   - Inspect the call record in `supplier_voice_calls`.
   - Check that `callStatus` transitions from `QUEUED` -> `IN_PROGRESS` -> `COMPLETED`.
   - Verify that the resulting quotation in `quotations` appears in the **Quotations** tab with badge **Pending Review**.

---

## 7. Cost Considerations & Operational Quotas

- **Sarvam Telephony Rates:** Standard Indian PSTN voice rates apply per minute of connected call (typically ₹0.75 - ₹1.50 / min depending on SIP provider tier).
- **Voice Agent Token Usage:** Billed per 1,000 conversational tokens processed by the speech-to-text, LLM, and text-to-speech models.
- **Calling Windows:** Restrict calls strictly between 10:00 AM and 6:00 PM IST on business days via Kovok's **Settings & Rules** module to prevent anti-spam compliance violations under TRAI (Telecom Regulatory Authority of India) guidelines.

