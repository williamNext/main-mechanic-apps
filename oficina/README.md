# Oficina Mobile

Client-facing Expo app. Talks to `server/` (see the [root README](../README.md) for the combined
setup and Android/physical-device connectivity guidance) — `mechanic-service.ts`,
`timeslot-service.ts`, `appointment-service.ts` and `notification-service.ts` still point at a
dead Supabase project and are out of scope until later phases.

## Secret model
- `public-build-vars`: safe in client bundle.
  - `EXPO_PUBLIC_API_URL`
- `private-server-secrets`: never ship to mobile app.
  - anything under `server/.env`

## Environment setup
1. Create `.env` from `.env.example`.
2. Set `EXPO_PUBLIC_API_URL` — see the [root README](../README.md#connectivity--talking-to-the-server-from-something-that-isnt-a-browser-on-this-machine)
   for what to set it to on an emulator or a physical device.

## Local development
```bash
npm install
npm run hooks:setup
npm run start
```

## Validation
```bash
npm run env:check
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
