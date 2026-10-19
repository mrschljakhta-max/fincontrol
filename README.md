# FINCONTROL

Private personal-finance tracker (Cloudflare Workers + D1). **Development starter — not deployed.**

## Status
- Private GitHub repository created.
- Initial API and D1 migration committed.
- D1 database, Access authentication and production UI are **not yet configured**.
- No real financial records have been inserted.

## Security before deployment
1. Create Cloudflare D1 database `fincontrol-db`, set its ID in `wrangler.jsonc`.
2. Apply migration: `npx wrangler d1 migrations apply fincontrol-db --remote`.
3. Configure Cloudflare Access to protect **the entire hostname**, including / and /api/*, with only your own identity allowed. Block or cover workers.dev and preview endpoints.
4. Set secret `ACCESS_AUD`. **Do not consider header presence alone cryptographic verification**; Access edge enforcement is mandatory, and production should additionally verify JWT signatures.
5. Only after securing access, deploy with `npx wrangler deploy` and test end-to-end.

## Planned financial baseline (not actual transactions)
- Debt reported: 120,000 UAH (including a 50,000 UAH camera gift).
- Expected income: 50,000 UAH on 2026-10-26, 30,000 UAH on 2026-11-04, 50,000 UAH on 2026-11-26.
- Estimated cigarette spending: 300 UAH/day.

These are **conversation estimates**, not verified bank data. Do not treat forecast income as received or publish personal finance data in this repository.
