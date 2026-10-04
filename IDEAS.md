# Ideas

These build on what MIRIN already does well — offline-first logging, minimal UI, real training data — instead of copying Strava, Hevy, or Whoop.

Ghost sets, plate stack, and the anti-shame consistency mechanic are the cheapest to prototype against the current schema.

## Ghost sets

Instead of prefilling last session's weight × reps as a number, show it as a faint ghost bar overlaid behind the input, like a rhythm game. You are not reading a stat; you are trying to beat the ghost. Same data already tracked, framed as a target instead of a fact. A subtler nudge toward progressive overload than a leaderboard or streak.

## Plate stack instead of a number

The weight stepper already exists. Render the actual plates that go on the bar (45 / 25 / 10 / 5…) as a small visual stack, and tap a plate to add or remove it instead of clicking a number. Closer to a Tesla-app interaction: it removes the mental math at the gym. Most apps just show "185 lb."

## Recovery-aware suggested weight

Whoop and Oura say "your recovery is 62%" and leave the interpretation to you. MIRIN could pull HRV and sleep from Apple Health and turn that into one concrete suggestion for the programmed lift: "Incline DB Press — try 40 lb today instead of 45, sleep was short." A smaller wedge than becoming a recovery platform: one recommendation on one exercise, using data already accessible.

## Blind PR mode

Optional, for big lifts. Hide the "last time" number until after the set is attempted, so the lifter is not anchoring or sandbagging to match the last set. Toggle it per exercise. A training-psychology feature that is cheap to build because historical sets are already stored.

## Anti-shame consistency

Streaks punish the day you miss one. The split is day-based (Push / Pull / Legs / Arms / Chest & Back) rather than calendar-based, so track rotations completed instead of days in a row. Missing a Tuesday shifts the rotation; it never breaks a streak. A different mental model from guilt-based habit trackers, and it fits because the app already auto-detects the next day in the rotation.

## Stateless share cards

Instead of profiles, feeds, and DMs, let a single PR or 1RM-trend chart generate one static, read-only link (like a Strava activity link) to drop in a group chat. No account required to view it, no feed, no follow graph — just the receipt. Shareability without the moderation and trust-and-safety burden of a social network.

## Voice and Watch-first logging

The thesis is minimal friction at the gym. A Siri Shortcut or watchOS complication that logs a set by voice ("Hey Siri, log 45 for 8") or a single watch-face tap removes the phone from the rep-to-rep loop. A natural extension of the offline-first, IndexedDB-first architecture: the watch queues writes the same way the phone already does.

## Muscle heat-map

Weak-point charts already exist (Lateral Raise, Rear Delt Flye, Incline Press). Instead of a full 3D clickable body, use a simple 2D front/back muscle silhouette shaded by weekly volume per muscle group. The same "everything in one visual" appeal, scoped to training data already on hand, without appearance-scoring.
