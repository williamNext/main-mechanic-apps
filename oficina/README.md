# Oficina Mobile

## Secret model
- `public-build-vars`: safe in client bundle.
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `private-server-secrets`: never ship to mobile app.
  - service-role keys
  - admin tokens

## Environment setup
1. Create `.env` from `.env.example`.
2. Set:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
3. In Netlify, set same keys in Site configuration > Environment variables.

## Local development
```bash
npm install
npm run hooks:setup
npm run start
```

## Validation and seed
```bash
npm run env:check
npm run seed
```

Workflow file runs:
- gitleaks on PR/push
- env validation on push to `master`

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
