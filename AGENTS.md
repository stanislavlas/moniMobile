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

---

## Code structure

```
App.jsx                 # Root: owns useAuth, useEntries, useHousehold, useCategories, useCurrencies; renders tab navigator
app/
  screens/              # One file per tab screen; receive all props from App.jsx (no data-fetching inside)
src/
  components/           # Reusable UI components (no data-fetching)
  contexts/             # ThemeContext (dark/light + color tokens), NetworkContext (online state + sync status)
  hooks/                # Custom hooks; own their state and expose it via return values
  services/             # Raw API calls and platform services (auth, entries, syncService, biometric, notifications, …)
  utils/                # Pure helpers: enums.js, logger.js, theme.js, queueStorage.js, enqueueAndSync.js, …
```

### State management
No Redux or Zustand. All state lives in hooks (`useState`/`useCallback`) wired up in `App.jsx` and passed down as props.

- **`useAuth`** — source of truth for `user`. On mount, reads from `AsyncStorage` immediately, then fires `getProfile()` in the background to sync server state. Handles biometric auto-login and session expiry via `authEvents`.
- **`useEntries`** — manages the local entry list. Write operations go through `enqueueAndSync()` so they work offline.
- **`useHousehold`** — auto-fetches when `isAuthenticated` changes.
- **`ThemeContext`** — provides `colors` (`C`) and `styles` (`S`) tokens to every component. Always destructure as `const { isDark, colors: C, styles: S } = useTheme()`.
- **`NetworkContext`** — provides `isOnline`, `queueSize`, `isSyncing`. Drives `<OfflineBanner>` and `<SyncIndicator>`.

### Offline-first writes
All entry mutations (create, update, delete) must go through the sync queue, not direct API calls.

```js
import { enqueueAndSync } from "../utils/enqueueAndSync.js";

// Enqueue the operation and kick off a background sync attempt:
await enqueueAndSync("entry.create", { ...payload });
```

`syncService` handles retries (max 5, exponential backoff) and emits events consumed by `NetworkContext`. Do not call `syncService` directly from screens — use `enqueueAndSync`.

### Services layer (`src/services/`)
Each file maps to one concern. All authenticated calls go through `authRequest()` from `auth.js`, which handles token refresh and 401 auto-logout via `authEvents.emit("expired")`. Services are **pure async functions** — no state, no React imports.

### Adding a new screen
1. Create `app/screens/MyScreen.jsx` — accept all data as props.
2. Add a tab entry to the `TABS` array in `App.jsx`.
3. Wire up state/handlers in `App.jsx` and pass down as props.

### Adding a new service call
1. Add a function to the relevant file in `src/services/`.
2. If it's a write that must work offline, expose it through `enqueueAndSync` rather than calling the API directly.
3. If state management is needed, add a `useCallback` wrapper in the matching hook in `src/hooks/`.

### Money / formatting
Always use `formatCurrency(value, currency)` from `src/utils/enums.js`. Never construct `Intl.NumberFormat` inline.

### Logging
Use `logger` from `src/utils/logger.js`. Never use `console.log` directly.
```js
logger.info('entries', 'fetching month data');
logger.warn('auth', 'token expired');
logger.error('sync', 'operation failed', e.message);
```
