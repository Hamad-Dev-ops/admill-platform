# Admill Platform

Admill is a vehicle recovery dispatch platform for the UAE — think Uber/Careem, but for tow trucks. Customers request roadside recovery, drivers accept and fulfill jobs in real time via GPS tracking and Socket.IO, and business owners manage their fleet, drivers, and job analytics. React Native mobile app backed by a Node.js/Express/MongoDB API.

## Structure

```
admill-platform/
├── backend/    Node.js + Express + TypeScript + MongoDB REST/Socket.IO API
└── mobile/     React Native app (Customer, Driver, Owner)
```

## Backend

```
cd backend
npm install
npm run dev      # nodemon + tsx, http://localhost:5000
npm test         # vitest
```

Requires a `.env` file (see `.env.example`) — MongoDB connection string, JWT secrets, Firebase Admin credentials, Cloudinary credentials.

## Mobile

```
cd mobile
npm install
npm start                          # Metro bundler
npx react-native run-android       # debug build to a connected device/emulator
```

Requires a `.env` file (see `.env.example`) — `API_BASE_URL`, `SOCKET_URL`, `GOOGLE_MAPS_API_KEY`. For Android, also requires `android/local.properties` (`sdk.dir=...`, forward slashes) and, for push notifications, `android/app/google-services.json` (Firebase project config — not included in this repo).

## Roles

- **Customer** — requests a recovery job, tracks driver location and job status in real time.
- **Driver** — receives nearby job offers, accepts/rejects, progresses a job through its lifecycle, streams live GPS while on duty.
- **Owner** — manages their company's drivers, vehicles, and documents; monitors jobs; views fleet analytics.

Role is fixed at registration — there is no role-switching.
