#!/usr/bin/env bash
# Production deploy gate: nothing reaches production unless it is committed, pushed to GitHub,
# and recorded (Vercel deployment metadata + a prod-* git tag on the exact commit).
# Usage: pnpm deploy:prod            (guards, deploy, tag, push tag)
#        pnpm deploy:prod --check    (guards only, no deploy)
set -euo pipefail
cd "$(dirname "$0")/.."
SCOPE="subs-3909s-projects"
CHECK_ONLY=false; [ "${1:-}" = "--check" ] && CHECK_ONLY=true

fail() { echo "DEPLOY BLOCKED: $1" >&2; exit 1; }

[ "$(git rev-parse --abbrev-ref HEAD)" = "main" ] || fail "not on main"
[ -z "$(git status --porcelain)" ] || fail "uncommitted changes — commit them first (git status):
$(git status --porcelain)"
grep -q 'const PREVIEW_BYPASS = false;' "src/app/(app)/layout.tsx" || fail "PREVIEW_BYPASS is not false in src/app/(app)/layout.tsx"
git fetch origin --quiet
[ "$(git rev-list --count HEAD..origin/main)" = "0" ] || fail "origin/main has commits you don't have — pull/rebase first"
[ "$(git rev-list --count origin/main..HEAD)" = "0" ] || fail "unpushed commits — git push origin main first, so GitHub has exactly what goes live"

SHA="$(git rev-parse HEAD)"; SHORT="$(git rev-parse --short HEAD)"
MSG="$(git log -1 --format=%s | cut -c1-100)"
echo "Guards passed. Deploying $SHORT ($MSG)"
$CHECK_ONLY && exit 0

OUT="$(npx --yes vercel --prod --yes --scope "$SCOPE" \
  --meta githubCommitSha="$SHA" --meta githubCommitRef=main \
  --meta githubCommitMessage="$MSG" --meta githubOrg=subs-lgtm --meta githubRepo=Weekly-numbers \
  --meta deployedFrom=deploy-prod.sh 2>&1 | tee /dev/stderr)"
echo "$OUT" | grep -q 'Aliased' || fail "deploy output shows no production alias — not tagging"

TAG="prod-$(date +%Y%m%d-%H%M)-$SHORT"
git tag -a "$TAG" -m "Production deploy of $SHORT: $MSG"
git push origin "$TAG"
echo "Recorded: https://github.com/subs-lgtm/Weekly-numbers/releases/tag/$TAG"
