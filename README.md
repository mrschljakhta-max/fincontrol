# FINCONTROL — browser dashboard

The GitHub Pages application starts at `index.html` → `analytics.html`. The older journal and overview remain at `ledger.html`. The separate Cloudflare prototype is documented below and is not deployed by this update.

## Dashboard (2026-10-21)

- Graphite / silver / wine palette, responsive sidebar and mobile bottom navigation.
- Money-flow map, linked category/date filters, 20 analytics measures, calendar heatmap, waterfall, category mosaic and distributions.
- Goal route and sequential debt → reserve → housing simulator. Contributions, rate and horizon are hypothetical inputs; saving a scenario does not create ledger records.
- Operation drawer (bottom sheet on mobile), keyboard command menu, configurable dashboard blocks and explicit in-memory demo.
- Current account balance is never inferred from transaction history. “Net flow” starts at zero for the selected period; unknown opening cash is labelled as an uncovered flow on the map.

## Data and recovery

Existing `fincontrol-*` localStorage keys and records are retained. There is no automatic data migration or network synchronization. The complete JSON backup includes all FINCONTROL modules; restore it from the journal page. Keep an exported copy outside the browser.

`assets/store.js` coordinates new writes with Web Locks (when available), validates records, checks revisions and uses a rollback journal for multi-key updates. On browsers without Web Locks, only same-tab queuing and conflict detection are available. Legacy forms reject stale-tab saves and ask for a reload. Use an up-to-date browser for cross-tab editing.

Credit payments update both the credit register and ledger in one transaction; linked records cannot be independently removed or overwritten by a partial backup. Public budget prefill amounts were removed. Mortgage APR is converted to a monthly rate once. Analytics includes empty calendar months and the end boundary of each date filter.

## Verification

Run `npm test` with Node; no frontend build step is required. Tests cover period boundaries, all accounting kinds, grouped filtering, sequential goal allocation, missing goal configuration, competing tab writes, quota failure rollback, full backup restoration, duplicate IDs and interrupted-write recovery.

---

## Existing Cloudflare prototype notes

Private personal finance tracker powered by Cloudflare Workers and D1.

## Verified from Cloudflare dashboard screenshots (2026-10-20)
- D1 database `fincontrol-db` exists and a synthetic INSERT, SELECT, DELETE, and final COUNT=0 succeeded.
- Worker `fincontrol` has production D1 binding `DB` → `fincontrol-db`.
- Worker Access policy `FINCONTROL Allow` lists the intended account.
- A login attempt showed **That account does not have access**. This remains unresolved.
- No successful production app/API session has been verified.

## Repository status
- Worker includes HTML interface, D1 entries API and JWT signature verification.
- D1 database ID is set in `wrangler.jsonc`.
- Runtime requires `ACCESS_AUD` and `ACCESS_TEAM_DOMAIN` configuration.
- Deployment and end-to-end tests have NOT been performed in this session.

## Next deployment steps
1. In Cloudflare Access, check the identity provider account email and the exact allowed identity. Confirm the policy applies to the `fincontrol` Worker and no more-specific hostname policy overrides it.
2. Configure `ACCESS_AUD` with the exact application AUD tag and `ACCESS_TEAM_DOMAIN` with the Access team hostname (e.g. `example.cloudflareaccess.com`). Never put credentials in GitHub.
3. Verify that Access protects both `/` and `/api/*`, including workers.dev and preview URLs.
4. Run `npm install`, `npx wrangler d1 migrations apply fincontrol-db --remote`, then `npx wrangler deploy` from a trusted deployment environment.
5. Check that unauthenticated requests cannot read the API, then sign in as the allowed account, create a **synthetic** entry, confirm it appears, export CSV, and remove it with an authorized D1 query.
6. Do not enter real personal finance records until these checks pass.

## Security
- The Worker validates JWT signatures using the Cloudflare Access team's JWKS and checks issuer, audience and expiry.
- Edge-side Access enforcement is still required.
- Do not make the application publicly accessible to bypass a login error.
- No production finance amounts or personal budget data are stored in this README.

