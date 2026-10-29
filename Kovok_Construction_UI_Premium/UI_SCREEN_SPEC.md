# Kovok — UI Screen-by-Screen Specification

## Design direction

Clean, restrained, table-first, quick to scan. Take interaction principles from ERPNext (traceable procurement records and separate PO/receipt/invoice), SAP Ariba Guided Buying (progressive questions and policy rules), Procore Materials (project-site and delivery context), Zoho Inventory (search/filter/table patterns), and JSW One MSME (Indian material buying and fulfilment context). Do not clone any brand.

## Global shell
- Left sidebar: Overview; Requests; Quotations; Orders & delivery; Exceptions; Product catalogue; Suppliers; Integrations. Settings & rules at bottom.
- Top bar: workspace/site selector, global search, notifications/help, primary `+ New request` action.
- Status chips use both text and color; no status depends on color alone.
- Every screen labels sample/demo data. No unverified price, stock or savings appears as live.
- Clicking a row opens a detail drawer, with a full detail page available for complex records.

## 1. Overview
Purpose: “What needs my attention today?”
- Four counters: open requests, quotes ready to review, orders at risk, approvals pending.
- Top priority queue: problem, request/order, site, business impact only if supported, latest verified fact, owner, next action and deadline.
- Recent procurement table: request ID, material/spec, quantity/site, required-by, state, current stage.
- Next deliveries: supplier, material, site, ETA and confirmation status.
- No spend/savings charts until reliable baselines exist.

## 2. Requests
- Table: request ID; material and key specification; quantity/UOM; project/site; needed-by; origin (voice/form/import/ERP); sourcing mode; state; quote count; owner; updated at.
- Filters by material, project/site, urgency, status, request source and value band.
- New request has four steps: Describe → Identify → Delivery & sourcing → Review & send.
- Input methods: voice entry, text, photo, BOQ/document, import, repeat previous request.
- Product identification must show candidate photo, name, attributes, source and match state (exact, specification match, possible, no verified match).
- Submit triggers supplier outreach only after buyer confirms the request.

## 3. Quotations
- Table: request; supplier; product-match state; delivered total; unit cost; quantity/stock confirmed; ETA; quote time/expiry; confirmation status; missing fields.
- Comparison page has the normalized request at top and up to three primary supplier columns; other offers in table rows.
- Price breakdown: item subtotal, discount, GST status/value, freight, loading/unloading/handling, other charges, delivered total, normalized unit cost.
- Commercial facts: matching specifications, offer quantity, availability, ETA, payment/credit terms, validity, returns/rejection terms and supplier evidence.
- Label offers `Confirmed`, `Partially confirmed`, `Unconfirmed`, `Expired`, or `Non-comparable`.
- Recommended option must explain its rationale and downside. Actions: clarify, request revision, select for approval, reject, export comparison.

## 4. Orders & delivery
- List: order/PO ID, request, supplier, material, approved quantity/total, supplier acknowledgement, dispatch state, ETA, receipt state, exception.
- Detail: immutable approved terms; supplier confirmation evidence; dispatch/tracking; ETA changes; receiving checklist; invoice/challan references; shortage/damage/mismatch.
- Explicit separate states: confirmed, dispatched, arrived, inspected/accepted, reconciled.
- Payment stays buyer-to-supplier. Kovok records status but does not hold money.

## 5. Exceptions
- Queue: priority, issue type, request/order/site, affected quantity/value if known, last verified fact, owner, next action/deadline, state.
- Types: ambiguous product, no supplier, no-answer, incomplete quote, expired/changed price, supplier shortfall, delivery risk/late, wrong material, damaged/short receipt, PO/invoice/receipt mismatch, integration conflict.
- Detail view: evidence and timeline, known/unknown facts, impact assumptions, available recovery plans, authority needed, call history and closure proof.
- Never close because a call was attempted. Closure condition is evidence-based.

## 6. Product catalogue
- Search by canonical/trade name, aliases, brand, product code, supplier SKU, IS reference.
- Filters by category, brand/manufacturer, specs, standard, status, image permission, supplier mapping and last verified.
- Table: thumbnail, canonical product, branded variant, category-specific attributes, standard, sale unit, status, supplier mappings, source/last checked.
- Status: verified, partially verified, provisional, needs review, retired.
- Product detail shows identity, typed properties, units, standard status/source/check date, branded variants, supplier SKU mappings, image/document provenance and rights.
- Actions: use in request, ask supplier to verify, add SKU mapping, report mismatch, propose correction.
- Image is an identification aid only; not proof of grade/compliance.
- Unknown item remains provisional; no automatic merge or verified label.

## 7. Suppliers
- List: name, verification state, categories/brands/grades, location/service area, language, contact permission, quote completeness, observed order history, status.
- Filter by serviceable area, category/spec eligibility, verified contact, preference/block, response and completed deliveries.
- Detail: contacts and permitted calling windows, material capability, catalogue import, buyer-specific terms, quote/order/call history and evidence-based performance.
- Do not show a meaningful reliability score before there is enough sample size; show sample count.

## 8. Integrations
- Initial: CSV/XLSX import/export; one tested connector (ERPNext is a good development candidate); add TallyPrime/Zoho only after demand validation.
- Screens: connector list, permission/scope, status, last sync, import preview, field mapping, duplicate/unmapped rows, dry run, sync conflicts and logs.
- Source of truth: existing ERP owns its records when connected; Kovok owns RFQs, call records, comparisons and exceptions. Write only supported, approved actions.
- Never silently overwrite conflicts. Do not collect secrets in ordinary onboarding chat.

## 9. Settings & rules
- Users/roles and workspace/site details.
- Approval thresholds and approvers.
- Supplier allowlist/blocklist, max vendors, sourcing value/risk threshold, call window, language and retry rules.
- Material substitution policy; approved brands/specs.
- Delivery/receipt requirements and exception escalation path.
- Integration and source-of-truth settings.
- Call recording/transcript retention and access.

## Global UI states
Every async activity needs visible states: queued, calling, connected, no answer, partial result, needs clarification, quote verified, quote expired, waiting for approval, order confirmed, delivery at risk, received pending inspection, reconciled, failed/retryable, failed/manual intervention. The system must never render fake “live” metrics or supplier facts.
