# Kovok — Business Onboarding Questions

## Principle

The business onboarding configures Kovok's procurement rules. It is different from the short questions asked for each purchase request. Keep onboarding progressive, save draft answers, skip questions that do not apply, and generate a reviewable workflow profile. Do not ask a user to design an AI agent or require a long form before they can try their first purchase.

## A. Workspace configuration (ask once, then update only when something changes)

### Step 1 — Business and operating context
**Goal:** understand the buyer, geography, and users.

Required:
- What is the business name?
- Which best describes the business: contractor/builder, construction material dealer, subcontractor, project procurement team, or other?
- Which cities/PIN codes or delivery areas do you operate in?
- How many active projects/sites or branches do you usually purchase for?
- Who will use Kovok: owner, buyer, site engineer, storekeeper, project manager, accounts, or others?
- Which material categories do you buy? TMT steel, cement, RMC, sand/aggregates, bricks/blocks, chemicals, pipes, electrical, finishes, other.

Ask conditionally:
- Do you buy for your own projects, for resale, or both?
- Do you have a dedicated receiving/store team at each site?

### Step 2 — Learn the current workflow from a real example
**Opening prompt:** “Walk me through your last material purchase, from the moment someone needed it until the material arrived and the bill was settled.”

Adaptive questions, asked only if not answered:
- Who first identifies the need: site engineer, BOQ/planning, storekeeper, owner, existing software, or supplier?
- How is a requirement recorded today: ERP, purchase software, spreadsheet, WhatsApp, phone, paper, or memory?
- What details do you usually know at the start, and what do you need to clarify later?
- Who finds and contacts suppliers?
- How many suppliers do you usually contact, and when do you contact just one?
- What causes the biggest delay: product identification, stock confirmation, price/freight, approvals, transport, site access, receiving, or invoice mismatch?
- When is a purchase considered complete in your process?

Do not ask every question if the narrative already provides the answer. Summarize the inferred workflow and ask the user to correct it.

### Step 3 — Product and specification rules
**Goal:** define what counts as the correct product for each category.

- Which specifications must be exact for TMT steel? (e.g. grade/designation, diameter, quantity/UOM, approved brand/mill policy, required documents)
- Which cement types/brands/pack sizes do you use? Is grade applicable to the selected type?
- Which standards, project specifications, approved-make lists or certificates must be respected?
- Which brands or suppliers are mandatory, preferred, blocked, or acceptable as alternatives?
- May Kovok suggest alternatives? Who must approve a substitution?
- What evidence is enough to identify an unfamiliar item: product code, official datasheet, label photo, drawing/BOQ line, or supplier confirmation?
- What should happen when a product is not in Kovok's catalogue?

Default: missing critical specification means ask the buyer or keep the match provisional. Never infer engineering suitability from a photo alone.

### Step 4 — Supplier sourcing rules

- Do you have an existing supplier list? Can it be imported from Excel/CSV?
- Should Kovok search approved suppliers only, use known suppliers first then discover new ones, or discover new suppliers immediately?
- Which regions/PIN codes are serviceable? Should the search use driving ETA, delivery zone, or simple radius first?
- What matters most: delivered total, stock/quantity, delivery date, credit terms, quality documents, supplier reliability, or preferred relationships?
- How many vendors may Kovok contact for a normal request? What about a high-value/urgent request?
- Which languages should the voice agent use? Hindi, English, Hinglish or another supported Indian language?
- When may calls be made? What retry limit applies? What should happen after no answer?
- May Kovok leave a message, send a follow-up, or contact a backup number? Under what rules?
- What is the minimum order value or risk threshold for a competitive RFQ? Can the buyer override this and explicitly request multiple quotes?

### Step 5 — Quote comparison rules

- Should the comparison always include material subtotal, discounts, GST, freight, loading, unloading, handling, other charges, and delivered total?
- Which charges must be known before an offer can be called comparable?
- How should tax-included versus tax-extra quotes be handled?
- Are partial quantities acceptable? If yes, under what conditions?
- How important is delivery date compared with lowest price?
- What credit/payment terms are acceptable?
- What is the quote-expiry rule? Must suppliers reconfirm after expiry?
- Should the system recommend “lowest compliant delivered cost,” “earliest compliant delivery,” or another transparent rationale?

### Step 6 — Approvals, permissions and recovery

- Who can approve a purchase? Is approval by amount, site, category, or project?
- Which person can approve a change to price, quantity, supplier, delivery date or material specification?
- What may Kovok do without asking again: retry calls, clarify quotes, search alternatives, request revised terms, or update a draft?
- What actions always require approval? Default: place/cancel an order, accept changed commercial terms, substitute a material, and commit to additional cost.
- If the supplier cannot fulfil the order, should Kovok search for the shortfall, request a revised schedule, or alert the owner first?
- If delivery is late, what tolerance and escalation process apply?
- If material is short, damaged, wrong or undocumented, who receives the alert and can accept/reject it?
- What evidence is required to close an exception?

### Step 7 — Delivery and receiving

- What details does the supplier need to deliver to the site?
- Are there gate timings, truck-size restrictions, unloading equipment, weighbridge or crane requirements?
- Can suppliers deliver partially? How should remaining quantity be tracked?
- Who confirms actual quantity and condition at receipt?
- Which photos, delivery challans, weighment slips, test certificates or invoices are needed?
- Who resolves a mismatch between PO, delivery, and invoice?

### Step 8 — Existing software and data

- Which tools do you currently use: ERPNext, TallyPrime, Zoho, another ERP/procurement tool, Excel/Google Sheets, WhatsApp, or none?
- Which system is the source of truth for products, suppliers, purchase orders, stock, invoices and payments?
- Should Kovok begin with an import/export file, read-only integration, or a write-back connector?
- What can Kovok read and write? Which records need to be synchronized?
- What should happen if the connected system is unavailable or a record conflicts?

Do not ask for passwords or API secrets through this conversational onboarding. Connector credentials belong in a secure connection flow.

### Step 9 — Review and activate

Kovok generates a profile including:
- Material categories and required fields.
- Supplier eligibility and sourcing threshold.
- Voice language, call window, retry/fallback rules.
- Quote comparison and comparability rules.
- Approval limits and forbidden actions.
- Delivery/receipt checklist and exception playbooks.
- Data sources and system-of-record mapping.

Before activation, run configurable test cases:
1. Complete, well-specified routine request.
2. Product description missing a critical specification.
3. Product absent from catalogue.
4. No supplier answers.
5. Incomplete or non-comparable quotation.
6. Changed price after approval.
7. Supplier can only fulfil a partial quantity.
8. Late delivery.
9. Wrong/damaged/short receipt.
10. Connected system fails to sync.

The owner reviews the generated profile and explicitly activates it. This configuration is rules + templates + connectors, not arbitrary generated production code.

## B. Per-purchase request questions (ask each time, with adaptive branching)

1. What do you need? (voice, text, photo, BOQ or imported request)
2. Which category and product/variant is it?
3. What required specifications are still missing?
4. What quantity and unit? Are conversions source-backed?
5. Where and when is it needed?
6. Is a brand/mill or approved-make list mandatory? Are alternatives permitted?
7. What are the site delivery, unloading and access constraints?
8. Is there a preferred supplier? Should Kovok obtain competitive quotes?
9. Is there a budget or maximum delivered cost? (optional)
10. Review the normalized request and authorize supplier outreach.

### TMT fields
- Product form, grade/designation, diameter (mm), quantity/UOM, approved brand/mill policy, delivery site/date, required documents. Never infer grade from image.

### Cement fields
- Cement type, grade only where applicable, brand/approved equivalent, pack size or bulk basis, quantity/UOM, site/date, applicable standard/reference, freshness/batch data only when available from the actual lot/offer.

### If an unknown material is requested
- Preserve the exact original buyer wording.
- Ask for one useful identifier: label/product-code photo, brand/model, source document, BOQ description, dimensions or intended use.
- Ask only category-specific missing questions.
- Create a request-scoped provisional record.
- Search source-permitted references and supplier catalogues.
- Call suppliers only with an explicit, unambiguous request for information; make no unverified claim about the product.
- Promote to shared catalogue only after identity, mandatory fields, source provenance, duplicate checks and image/data rights have passed review.
