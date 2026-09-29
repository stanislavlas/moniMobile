# AGENTS.md

## Version bumping

This is an Expo/React Native Android app. Version is tracked in two files.

**Before every commit:**
1. Determine the appropriate version bump based on the change:
   - `PATCH` (x.x.1) — bug fixes, config tweaks, documentation
   - `MINOR` (x.1.0) — new features, non-breaking changes
   - `MAJOR` (2.0.0) — breaking changes
2. Propose the new version to the user: "I'll bump the version from `1.0.0` to `1.0.1` (patch — reason). OK?"
3. Wait for confirmation or override before committing.
4. Bump **all three** values in the same commit:
   - `package.json` — `"version"` field
   - `app.json` — `expo.version` field
   - `app.json` — `expo.android.versionCode` field (increment by 1 — must always increase monotonically for Play Store)
