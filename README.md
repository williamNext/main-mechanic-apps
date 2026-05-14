# Oficina Mobile

## Secret model
- `public-build-vars`: safe in client bundle.
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `private-server-secrets`: never ship to mobile app.
  - service-role keys
  - admin tokens

## Doppler setup
1. Create Doppler project `oficina`.
2. Create configs: `dev`, `staging`, `prod`.
3. Add secrets per config.
4. Use service tokens in CI:
   - `DOPPLER_TOKEN_DEV`
   - `DOPPLER_TOKEN_STAGING`
   - `DOPPLER_TOKEN_PROD`

## Local development
```bash
npm install
npm run hooks:setup
npm run start:doppler
```

## Validation and seed
```bash
npm run env:check
npm run seed:doppler
```

## EAS/CI mapping
- `development` profile -> Doppler `dev`
- `staging` profile -> Doppler `staging`
- `production` profile -> Doppler `prod`

Workflow file runs:
- gitleaks on PR/push
- Doppler env validation on push to `master`

## History cleanup for leaked `.env`
Run once on maintainer machine, then force push:
```bash
git filter-branch --force --index-filter "git rm --cached --ignore-unmatch .env" --prune-empty --tag-name-filter cat -- --all
git for-each-ref --format="%(refname)" refs/original/ | xargs -n 1 git update-ref -d
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push origin --force --all
git push origin --force --tags
```

After force-push, collaborators must hard reset or re-clone.
