# Moni

Expo SDK ~57 / React Native 0.86 mobile app for Moni — a personal household finance tracker.

## Tech Stack

- Expo SDK ~57
- React Native 0.86.3
- React 19.2.3
- React Navigation v7
- AsyncStorage for offline caching
- Expo SecureStore for token storage
- Expo Local Authentication (biometrics)

## Quick Start

### Prerequisites

- Node.js 18+
- Expo Go app on your phone (Android or iOS)
- [MoniAPI](https://github.com/stanislavlas/moniAPI) running on your local machine
- Phone and computer on the same WiFi network

### Setup

```bash
npm install
```

Copy `.env.example` to `.env` and set your machine's LAN IP:
```bash
cp .env.example .env
# Edit .env:
# EXPO_PUBLIC_API_BASE_URL=http://<YOUR_MACHINE_IP>:8080
```

Finding your IP:
- **macOS:** `ipconfig getifaddr en0`
- **Linux:** `hostname -I | awk '{print $1}'`
- **Windows:** `ipconfig` (IPv4 Address)

### Run

```bash
npx expo start
```

Scan the QR code with Expo Go.

### Android emulator

```bash
npx expo start --android
```

Use `http://10.0.2.2:8080` as the API URL when running in an Android emulator (maps to host `localhost`).

### Clear Metro cache

```bash
npx expo start --clear
```

## Build (EAS)

```bash
npm install -g eas-cli
eas login
eas build --platform android --profile preview
```

## Screens

| Screen | File |
|---|---|
| Login / Register | `app/screens/AuthScreen.jsx` |
| Dashboard | `app/screens/DashboardScreen.jsx` |
| Add Entry | `app/screens/AddScreen.jsx` |
| History | `app/screens/HistoryScreen.jsx` |
| Categories | `app/screens/CategoriesScreen.jsx` |
| Household | `app/screens/HouseholdScreen.jsx` |
| Account | `app/screens/AccountScreen.jsx` |

## Project Structure

```
├── App.jsx               # Root — auth gate, navigation
├── index.js              # Entry point
├── app/screens/          # Screen components
├── src/
│   ├── hooks/            # React hooks (auth, entries, household, categories)
│   ├── services/         # API clients
│   ├── utils/            # Theme, default categories
│   └── components/       # Shared UI components
└── assets/               # Images, fonts
```

## Environment Variables

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | Base URL of MoniAPI (e.g. `http://192.168.1.100:8080`) |

Never use `localhost` — on a physical device it refers to the phone itself, not your computer.
