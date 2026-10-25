# App Store listing

Fill these in App Store Connect after a TestFlight build from Xcode 26. The binary is the Capacitor iOS project in `ios/`. Bundle id: `app.mirin.ios`.

## You still do this in Apple and Supabase

- Apple Developer Program membership, then an App ID for `app.mirin.ios` with Sign in with Apple enabled.
- App Store Connect app record, support URL, and a support email.
- A privacy policy URL: `https://<your-host>/privacy.html` (the file is `public/privacy.html`).
- Supabase Apple provider, with `mirin://auth/callback` and your web origin on the redirect allow list.
- Deploy `supabase/functions/delete-account`.
- A reviewer demo account (email and password) that already has a few logged sets.

## Listing

- Name: MIRIN
- Subtitle: Private overload log
- Category: Health & Fitness
- Price: Free. No in-app purchases.
- Age rating: answer the questionnaire for a fitness log with no ads, no unrestricted web browsing, and no user-generated public content. Expect 4+.
- Export compliance: the app only uses standard HTTPS. `ITSAppUsesNonExemptEncryption` is already false.

Description:

MIRIN is a personal training log. It remembers the last weight and reps, prefills them, and asks for one tap to confirm the set.

The log stays on the device first, then syncs to the signed-in account. Body weight, protein, and calories sit on their own screen. Trends are the sets you already logged.

Keywords: workout,training,log,sets,reps,overload,gym,lifting

Promotional text and the description must not say the app diagnoses, treats, or coaches. Do not use "for kids".

## App Privacy

All of these are collected, linked to the user, used for app functionality, and not used for tracking.

- Contact Info: name, email
- Health & Fitness: fitness (sets, body weight, protein, calories)
- Identifiers: user id

No tracking. No App Tracking Transparency prompt. Do not declare HealthKit. Data is not written to iCloud.

## Screenshots

Capture on a signed-in iPhone at the 6.9-inch size App Store Connect asks for. Use the real screens, not a marketing frame.

1. Today, with a set ready to log.
2. History, with sessions on the calendar.
3. Profile, with the physique visible.

## Review notes

Paste this, with the demo password filled in:

```
Demo account: <email>
Password: <password>

MIRIN is a private training log. Logging writes on the device first and syncs when the account is online. Sign in with Apple is next to Google on the sign-in screen. Account deletion is under Profile → Account → Delete account. The privacy policy is linked there and at /privacy.html.
```
