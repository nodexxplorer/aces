# ACES Zone — Mobile (Student)

React Native (Expo, managed) rebuild of the student-facing portion of the ACES Zone web app. Talks to the same backend (`../backend`) over the same REST API — no backend changes were needed.

## Stack

- **Expo SDK 57** + **expo-router** (file-based routing, `Stack.Protected` auth guards)
- **react-native-reanimated** for entrance/press animations, **expo-linear-gradient** for the brand gradient header
- **zustand** + **expo-secure-store** for auth state (Bearer token, not cookies — see `src/api/client.ts`)
- **Inter** font family, matching the web app's typography

## Running it

```bash
cd mobile
npm install         # first time only
npm start           # then scan the QR code with Expo Go on your phone
```

Your phone and dev machine must be on the **same Wi-Fi network**. Expo Go can't reach `localhost` on your computer — that's the phone itself — so `.env` points at your machine's LAN IP instead:

```
EXPO_PUBLIC_API_URL=http://<your-machine-LAN-IP>:8080/api/v1
```

Find your current IP with `hostname -I` (Linux) and update `.env` if it's changed since the last time this was set, or if you're on a different network. Your backend also needs to actually be reachable there — `SERVER_ADDRESS=0.0.0.0:8080` in `backend/.env` (already the default) rather than bound to `127.0.0.1` only.

## What's in v1

- **Home** — CGPA, level, next class, outstanding dues, attendance rate, carryovers, recent announcements, recent grades
- **Courses** — registered courses + materials per course
- **Payments** — outstanding dues, transaction history, paid/outstanding summary
- **Manuals** — browse + owned manuals
- **Updates** — notifications + announcements feed

## Known v1 simplifications (not bugs — deliberately deferred)

- **No in-app checkout.** Payments/manuals screens are read-only; buying a manual or paying a due still needs the web app for now. Paystack checkout on mobile needs a WebView + deep-link-back flow, which is its own chunk of work.
- **No course registration flow.** The Courses tab shows what you're already registered for; registering for new courses each semester still needs the web app.
- **GPA Tools, Study Planner, Grade Appeals, Transcripts, Practicals, Complaints, Job Board, Connect, Alumni Portal** aren't built yet — out of the agreed v1 scope (Core + Manuals + Communication).
- Every screen list-renders inside a `ScrollView` (via `Screen`) rather than a virtualized `FlatList` for the outer scroll — fine at today's data volumes, worth revisiting if any list grows into the hundreds of rows.

## Design system

`src/theme/colors.ts` mirrors the web app's Tailwind palette exactly (same hex values) so the two apps read as one product. Semantic tokens (`theme.primary`, `theme.card`, etc.) auto-switch between `lightTheme`/`darkTheme` based on the OS appearance setting — screens should never import `palette` directly.
