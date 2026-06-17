#!/usr/bin/env bash
# Bump the app's version, commit, tag, and push — which triggers the release
# workflow (.github/workflows/release.yml fires on v* tags).
#
# The version source of truth is src-tauri/tauri.conf.json — the value Tauri
# stamps into the bundle/.dmg. (A Tauri app has no Xcode MARKETING_VERSION;
# this field is its user-facing equivalent.) Cargo.toml's crate version is
# left untouched.
#
# Usage:
#   scripts/bump-version.sh patch            # 0.1.0 -> 0.1.1
#   scripts/bump-version.sh minor            # 0.1.0 -> 0.2.0
#   DRY_RUN=1 scripts/bump-version.sh patch  # print the plan; no writes, no push
#
# Note: releases are cut from `main` by default — change RELEASE_BRANCH below
# if your project releases from a different branch.

set -euo pipefail

RELEASE_BRANCH="main"

KIND="${1:-}"
case "$KIND" in
    patch | minor) ;;
    *)
        echo "Usage: $0 <patch|minor>" >&2
        exit 1
        ;;
esac

CONF="src-tauri/tauri.conf.json"
[ -f "$CONF" ] || {
    echo "Error: $CONF not found — run from the repo root." >&2
    exit 1
}

# Guardrails: cut releases from a clean release branch, so the tag matches
# exactly what is committed and `git push` carries the bump commit.
branch=$(git rev-parse --abbrev-ref HEAD)
if [ "$branch" != "$RELEASE_BRANCH" ]; then
    echo "Error: on branch '$branch'; releases must be cut from '$RELEASE_BRANCH'." >&2
    exit 1
fi
if [ -n "$(git status --porcelain)" ]; then
    echo "Error: working tree is dirty. Commit or stash changes first." >&2
    exit 1
fi

# Compute current + next version (node parses the JSON robustly).
read -r CUR NEXT < <(node -e '
  const fs = require("fs");
  const [file, kind] = process.argv.slice(1);
  const cur = JSON.parse(fs.readFileSync(file, "utf8")).version;
  if (!/^\d+\.\d+\.\d+$/.test(cur)) {
    console.error("Unparseable version: " + cur);
    process.exit(1);
  }
  const [maj, min, pat] = cur.split(".").map(Number);
  const next = kind === "minor" ? `${maj}.${min + 1}.0` : `${maj}.${min}.${pat + 1}`;
  // Emit a trailing newline so `read` finds its delimiter and returns 0;
  // without it `read` exits 1 on EOF and `set -e` aborts the script silently.
  console.log(cur + " " + next);
' "$CONF" "$KIND")
[ -n "${NEXT:-}" ] || {
    echo "Error: failed to compute the next version." >&2
    exit 1
}

TAG="v$NEXT"
echo "Bumping $CUR -> $NEXT (tag $TAG)"

if [ -n "${DRY_RUN:-}" ]; then
    echo "[dry-run] would: update $CONF, commit, tag $TAG, push origin $RELEASE_BRANCH + $TAG"
    exit 0
fi

# Write the new version with a targeted string replace so only the value
# changes (preserves the file's existing formatting).
node -e '
  const fs = require("fs");
  const [file, cur, next] = process.argv.slice(1);
  const s = fs.readFileSync(file, "utf8");
  fs.writeFileSync(file, s.replace(`"version": "${cur}"`, `"version": "${next}"`));
' "$CONF" "$CUR" "$NEXT"

git add "$CONF"
git commit -m "chore: release $TAG"
git tag -a "$TAG" -m "$TAG"
git push origin "$RELEASE_BRANCH"
git push origin "$TAG"

echo "Pushed $TAG — the release workflow will build, sign, notarize, and publish it."
