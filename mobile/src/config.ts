// The deployed web app's origin — used for anything that has to interop with
// the website (profile QR codes, "open on web" links). Not derived from
// EXPO_PUBLIC_API_URL since that points at the API host, not the frontend.
export const WEB_ORIGIN = 'https://aces-ivory.vercel.app';

// Matches PROFILE_SCAN_PARAM in frontend/src/utils/qr-scanner.ts — a
// student's profile QR must encode the exact same query param name so it
// scans identically whether the reader is a class rep's web dashboard or
// this app's own scanner.
export const PROFILE_SCAN_PARAM = 'scan';
