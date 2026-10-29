# Kovok Construction Procurement UI — Pre-build Prototype

This package is a **clickable, front-end concept prototype** for the agreed Kovok product. It is designed to settle navigation, core screens, buyer onboarding and the procurement request flow before implementing the production backend.

## Run

- Open `index.html` in a current desktop or mobile browser; or
- From this folder run `python -m http.server 8000`, then open `http://localhost:8000`.

No package install is required.

## What works in this prototype

- Navigation between Overview, Requests, Quotations, Orders & delivery, Exceptions, Product catalogue, Suppliers, Integrations, and Settings & rules.
- Workspace configuration wizard that asks about business profile, current procurement process, material rules, supplier contact rules, approval/recovery permissions, and existing tools.
- New purchase request wizard with TMT and cement-specific fields, project/site, PIN code, delivery deadline and sourcing preference.
- Sample quotation comparison that distinguishes a comparable offer from an incomplete one.
- Supplier shortfall recovery dialog.
- Product catalogue review and provisional product form.
- Responsive desktop/mobile layout.

## Important limitations

- All records and prices are sample data for UI review.
- The voice entry button is a UI placeholder. Sarvam Voice Agents is not connected.
- No real supplier calls, API requests, authentication, database writes, imports, orders, or notifications occur.
- Do not use sample price values as market quotations.
- Product data and images need source, rights, and verification before being treated as real.

## Design references

The interface uses interaction patterns, not copied designs, from ERPNext Buying (linked procurement records and receipt distinction), SAP Ariba Guided Buying (guided questions and approvals), Procore Materials (project and delivery context), Zoho Inventory (searchable records and supplier/item data), and JSW One MSME (Indian construction-material buying context).

## Build recommendation

Implement next in this order:
1. Product/category schema + validated catalogue search.
2. Persistence and procurement state machine.
3. Sarvam call initiation + webhook ingestion + idempotency.
4. Quote normalization and deterministic delivered-cost comparison.
5. Approval-gated order confirmation.
6. Exception recovery, integrations, and receipt reconciliation.
