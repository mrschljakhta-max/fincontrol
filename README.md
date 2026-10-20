# FINCONTROL

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
