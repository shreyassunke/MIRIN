# Product

## Register

product

## Users

Each account is one lifter. Context of use: mid-workout, in a gym, one-handed on a phone, between sets, often with elevated heart rate and limited patience. The job to be done is logging a set — weight, reps — in under three seconds, and occasionally reviewing whether a lift is actually progressing.

There is no coach persona, no onboarding funnel, no sharing, no social layer. Accounts exist so each person's log stays private and available across devices — not for community features.

## Product Purpose

MIRIN is a personal workout tracker for progressive overload with minimal friction. It remembers what was lifted last time, prefills it, and asks only for a tap to confirm or a nudge to adjust. Success looks like: every set of every session logged without the app ever being the reason a rest period ran long, and trend data trustworthy enough to make programming decisions (especially for the priority lifts: Lateral Raise, Rear Delt Flye, Incline Press).

Auth and cloud sync use Supabase. The client still writes to IndexedDB via Dexie first so logging stays fast offline; sync is a background concern, never the mid-set path.

## Brand Personality

Quiet, functional, precise. The app is a logbook, not a coach. No motivational copy, no streaks, no confetti, no hype, no emoji, ever. The tone of every label and empty state is the tone of a well-kept paper training journal: it states facts and gets out of the way. The data itself is the only feedback the user needs.

## Anti-references

This must never look like:

- Purple gradients or any gradient-as-decoration
- Glassmorphism (decorative blur, frosted cards)
- The "ai-color-palette" (indigo/violet/cyan defaults)
- Side-stripe borders (colored `border-left` accents on cards or list items)
- The generic shadcn dashboard look (identical card grids, hero metrics, icon+heading+text tiles)
- Gradient text
- Ghost cards
- Drop-shadow-heavy cards
- Fitness-app hype: badges, streaks, "crushing it" copy, progress rings as celebration

## Design Principles

1. **Log first, everything else second.** Every screen has exactly one primary action. On /today it is confirming the current set. Nothing competes with it — no dashboard-itis.
2. **Prefill over input.** The app remembers so the user doesn't type. Last session's weight×reps is the default; adjustment is steppers, confirmation is one tap. Zero required typing for a normal set.
3. **Quiet by default.** No praise, no persuasion. Labels state facts ("3 sets logged", not "Great work!"). Motion conveys state, never celebration.
4. **The data is the interface.** Numbers are the content — set them in tabular figures, give them hierarchy, and keep chrome minimal. Charts are thin, ungridded, single-color instruments for reading trends, not decoration.
5. **Guide, never block.** Empty states offer sensible starting defaults instead of blank fields. A first-ever session is loggable immediately.

## Accessibility & Inclusion

- WCAG AA contrast minimums throughout (body text ≥4.5:1, large text ≥3:1) — already satisfied by the locked palette (#8a8a8a on #0a0a0a is ~5.7:1).
- Large tap targets (≥44px) for all mid-workout controls; the app is used one-handed with compromised fine motor control.
- `prefers-reduced-motion` respected on every animation, including the rest-timer ring (fall back to a numeric countdown).
- No information conveyed by color alone; the single-accent palette makes this near-automatic.
