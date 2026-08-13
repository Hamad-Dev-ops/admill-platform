# Admill Platform

Admill is a vehicle recovery dispatch platform for the UAE — think Uber/Careem, but for tow trucks. Customers request roadside recovery, drivers accept and fulfill jobs in real time via GPS tracking and Socket.IO, and business owners manage their fleet, drivers, and job analytics. React Native mobile app backed by a Node.js/Express/MongoDB API.

## Structure

```
admill-platform/
├── backend/    Node.js + Express + TypeScript + MongoDB REST/Socket.IO API
└── mobile/     React Native app (Customer, Driver, Owner)
```

## Roles

- **Customer** — requests a recovery job, tracks driver location and job status in real time.
- **Driver** — receives nearby job offers, accepts/rejects, progresses a job through its lifecycle, streams live GPS while on duty.
- **Owner** — manages their company's drivers, vehicles, and documents; monitors jobs; views fleet analytics.

Role is fixed at registration — there is no role-switching.

---

## Prerequisites

- **Node.js 22+** (both `backend` and `mobile` require it)
- **MongoDB Atlas** account (or any reachable MongoDB instance) — no local Mongo setup is provided
- **Android Studio** with an Android SDK installed, if building/running the mobile app for Android
- A **Google Maps API key** (Maps SDK for Android) — required, the app renders a solid black screen without one
- Optional: **Cloudinary**, **Firebase project**, **OpenWeatherMap**, **OpenRouteService** accounts — see the env var notes below for what each unlocks

## 1. Clone

```
git clone https://github.com/Hamad-Dev-ops/admill-platform.git
cd admill-platform
```

## 2. Backend setup

```
cd backend
npm install
cp .env.example .env
```

Fill in `.env`:

| Variable | Required? | Notes |
|---|---|---|
| `PORT` | yes | defaults to 5000 |
| `MONGO_URI` | **yes** | MongoDB Atlas connection string |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | **yes** | any strong random strings |
| `JWT_ACCESS_EXPIRY` / `JWT_REFRESH_EXPIRY` | yes | defaults are fine (`15m` / `30d`) |
| `FRONTEND_URL` | yes | CORS origin — set to wherever the mobile app / any web client actually runs from |
| `CLOUDINARY_*` | needed for document/vehicle photo uploads | sign up at cloudinary.com |
| `OPENWEATHER_API_KEY` | needed for the pricing engine's weather factor | free tier at openweathermap.org |
| `OPENROUTESERVICE_API_KEY` | optional | without it, distance/ETA falls back to a straight-line (Haversine) estimate |
| `FCM_PROJECT_ID` / `FCM_CLIENT_EMAIL` / `FCM_PRIVATE_KEY` | needed for push notifications | Firebase project → Service Accounts → generate a private key |
| `DEFAULT_COMPANY_CODE` | **needed before customer job creation will work — see gotcha below** | |

Run it:

```
npm run dev      # nodemon + tsx, http://localhost:5000
npm test         # vitest — should pass with no other setup
```

**Gotcha — bootstrapping the operational company:** the app currently runs as a single operational company (not multi-tenant selection). A brand-new database has no company yet, so `POST /jobs` (customer creating a job) will fail until one exists. First run:
1. Register a user with `role: OWNER` (`POST /api/v1/auth/register`)
2. Create a company as that owner (`POST /api/v1/companies`)
3. Read its `companyCode` back (`GET /api/v1/companies/me`)
4. Put that code in `DEFAULT_COMPANY_CODE` in `.env` and restart the server

## 3. Mobile setup

```
cd mobile
npm install
cp .env.example .env
```

Fill in `.env`:

| Variable | Notes |
|---|---|
| `API_BASE_URL` | `http://10.0.2.2:5000/api/v1` for the Android emulator talking to a backend on the same machine. A **physical device** needs your machine's real LAN IP instead (or a tunnel — see below). |
| `SOCKET_URL` | same host as above, no `/api/v1` suffix |
| `GOOGLE_MAPS_API_KEY` | required — get one at console.cloud.google.com, enable "Maps SDK for Android", restrict it to package `com.admillmobile` + your signing cert's SHA-1 (`cd android && ./gradlew signingReport`) |

**Android-only setup:**
- Create `android/local.properties` containing `sdk.dir=<path to your Android SDK>` — **use forward slashes even on Windows** (e.g. `C:/Users/you/AppData/Local/Android/Sdk`). A backslash path here causes a cryptic Gradle failure.
- Push notifications need `android/app/google-services.json` from a Firebase project (Firebase Console → Project Settings → your Android app, package `com.admillmobile`) — the app runs fine without it, push registration just no-ops.

Run it:

```
npm start                          # Metro bundler
npx react-native run-android       # installs + runs a debug build on a connected device/emulator
```

**Testing on a physical phone (not an emulator):** a **debug** build needs Metro reachable from the phone — either plug in via USB and run `adb reverse tcp:8081 tcp:8081`, or put your machine's LAN IP in the app's in-app dev menu (shake the device) if on the same WiFi. A **release** build (`npx react-native run-android --variant=release`, or `cd android && ./gradlew assembleRelease`) has the JS bundle compiled in and needs neither Metro nor USB — only normal network access to the backend. Either way, the phone still needs to reach the *backend* — see the next section.

Verify everything:

```
npx tsc --noEmit
npx eslint .
npx jest --watchAll=false --ci
```

## Running everything (exact terminals, in order)

Several of the commands above are **long-running** — they block the terminal they're started in and must stay open the whole time you're using the app. This section ties them together so it's unambiguous what goes where.

### Scenario 1 — Android emulator, same machine (simplest, good for a first check)

Open **3 separate terminal windows**:

**Terminal 1 — backend** (leave this running the whole time):
```
cd admill-platform/backend
npm run dev
```
Wait until it prints that it's listening (e.g. `Server running on port 5000`) before moving on.

**Terminal 2 — Metro bundler** (leave this running the whole time):
```
cd admill-platform/mobile
npm start
```
Wait for Metro's splash screen/menu to appear.

**Terminal 3 — build and launch** (this one runs, finishes, and exits — it does *not* need to stay open):
```
cd admill-platform/mobile
npx react-native run-android
```
This installs and opens the app on whatever Android emulator/device is currently connected (check with `adb devices` first if unsure). The running app automatically talks to Terminal 2 (Metro, for the JS bundle) and Terminal 1 (the backend, via `http://10.0.2.2:5000` — the emulator's built-in alias for "this same machine").

### Scenario 2 — physical Android phone, reachable from anywhere (ngrok)

Same 3 terminals as Scenario 1, plus one more, and do this step **before** building:

**Terminal 2.5 — ngrok tunnel** (leave this running the whole time):
```
ngrok http 5000
```
Copy the `https://*.ngrok-free.dev` URL it prints into `mobile/.env`'s `API_BASE_URL`/`SOCKET_URL` (see the section below) — do this *before* running Terminal 3's build command, so the app is built pointing at the right backend URL.

Also, with the phone connected via USB: run `adb reverse tcp:8081 tcp:8081` once so the phone can reach Terminal 2's Metro, then continue with Terminal 3 (`npx react-native run-android`) as in Scenario 1.

### Scenario 3 — a release APK on a physical phone (no Metro needed at all)

Only **Terminal 1** (backend, or the ngrok tunnel from Scenario 2 if the phone isn't on the same WiFi) needs to be running once the APK is installed — a release build has the JS bundle compiled in, so there's no Metro/Terminal 2/Terminal 3 dependency after this one-time build step:
```
cd admill-platform/mobile/android
./gradlew assembleRelease
```
Then copy `android/app/build/outputs/apk/release/app-release.apk` to the phone and install it directly (tap the file, or `adb install app-release.apk` over USB). From then on, just keep Terminal 1 (and the ngrok terminal, if used) running whenever the app needs to reach the backend.

## Making the backend reachable from a real phone ("going live" for testing)

Everything above runs the backend on `localhost` — fine for an emulator on the same machine, not reachable from an actual phone unless it's tunneled or hosted somewhere. Two options, depending on what you need:

### Option A — ngrok tunnel (fastest, what this project has actually been tested with)

Gives your local backend a public HTTPS URL in about a minute. Good for testing/demos; the URL is temporary (changes every time you restart the tunnel, unless you pay for a reserved domain).

1. Sign up free at [ngrok.com](https://ngrok.com), then install it (`choco install ngrok` on Windows, `brew install ngrok` on Mac, or download the binary directly).
2. One-time setup: `ngrok config add-authtoken <your token>` (found on your ngrok dashboard).
3. With the backend already running (`npm run dev` in `backend/`), open a second terminal and run:
   ```
   ngrok http 5000
   ```
4. ngrok prints a public URL like `https://random-name.ngrok-free.dev`. Put it in `mobile/.env`:
   ```
   API_BASE_URL=https://random-name.ngrok-free.dev/api/v1
   SOCKET_URL=https://random-name.ngrok-free.dev
   ```
5. Rebuild/restart the mobile app so it picks up the new `.env` values. The phone now reaches your backend over **any network** (WiFi, cellular data) — not just the same LAN.

**Keep the ngrok terminal window open** — closing it kills the tunnel and the app will stop reaching the backend until you run `ngrok http 5000` again and update `.env` with the new URL it gives you.

### Option B — real hosting (persistent, for anything beyond local testing)

Not set up in this repo — there's no Dockerfile, hosting config, or deployed instance today. If you need the backend to stay up without your machine running (e.g. handing the app to someone else to use over days, not a one-off test session), you'd deploy `backend/` to a Node host (Render, Railway, Fly.io, a VPS, etc.), point its `MONGO_URI` at the same or a fresh Atlas cluster, set all the same `.env` variables there instead, and point `mobile/.env`'s `API_BASE_URL`/`SOCKET_URL` at that host's permanent URL instead of an ngrok one. That's a real infrastructure decision (which provider, cost, domain) — flagging it as the next step rather than a covered one.

## Building an APK

```
cd mobile/android
./gradlew assembleDebug     # android/app/build/outputs/apk/debug/app-debug.apk
./gradlew assembleRelease   # android/app/build/outputs/apk/release/app-release.apk
```

Both are currently signed with the checked-in `debug.keystore` (fine for internal testing; not appropriate for a Play Store release).
