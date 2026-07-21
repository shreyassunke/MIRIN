---
name: MIRIN
description: A quiet, near-black logbook for progressive overload — data-first, friction-free daily set logging.
colors:
  ink: "#fafafa"
  ink-muted: "#8a8a8a"
  accent: "#d4d4d4"
  bg: "#0a0a0a"
  surface: "#141414"
  border: "#232323"
typography:
  headline:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "0"
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0"
  data:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
    fontFeature: "tnum"
rounded:
  md: "8px"
  xl: "20px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.bg}"
    rounded: "{rounded.md}"
    padding: "12px 20px"
  button-primary-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.bg}"
    rounded: "{rounded.md}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px 20px"
  button-secondary-hover:
    backgroundColor: "#1c1c1c"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "16px"
  input:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
---

# Design System: MIRIN

## 1. Overview

**Creative North Star: "The Well-Kept Logbook"**

MIRIN looks like a precise instrument, not an app trying to impress. The entire surface is a near-black field (#0a0a0a) on which numbers — weights, reps, trends — are the only stars. There is one accent, and it isn't a color: it's off-white (#d4d4d4), reserved for the single primary action on each screen. Everything else is grayscale hierarchy: bright ink for the data that matters, muted ink for context, hairline borders for content structure.

Floating chrome (mobile nav, rest timer, segmented controls, steppers) uses purposeful frosted glass so thumb-zone controls feel physical without frosting the log itself. Content cards stay solid. This system rejects decorative glass, purple gradients, gradient text, ghost cards, side-stripe borders, identical card grids, and fitness-app hype. It is used mid-workout, one-handed, between sets — so density is moderate, tap targets are large, and each screen has exactly one primary action.

**Key Characteristics:**
- Near-black monochrome with a single off-white accent for primary actions
- Content structured by 1px hairline borders; floating chrome may use frosted glass
- Tabular-figure numerals as the visual centerpiece
- 8px spacing grid, generous whitespace, one primary action per screen
- Charts as thin single-color instruments: 1.5px lines, no gridlines
- Brief logo hold on cold open, then reveal the task (once per session)

## 2. Colors

A locked grayscale palette; hierarchy is carried entirely by lightness, never by hue.

### Primary
- **Off-White Accent** (#d4d4d4): Fill of the one primary action per screen (the "Log set" button, the confirm control). Also the single stroke color for all charts. Its rarity is what makes it read as an accent.

### Neutral
- **Near-Black** (#0a0a0a): The body background everywhere. Near-black, not pure black — it keeps hairline borders and surfaces legible.
- **Surface** (#141414): Content cards and data panels. Always paired with its hairline border.
- **Hairline** (#232323): 1px borders on content surfaces and inputs.
- **Glass** (rgb(20 20 20 / 0.62) + 18px blur): Floating chrome only — mobile nav, sticky mobile header, rest timer, segmented controls.
- **Ink** (#fafafa): Primary text — exercise names, logged numbers, headings.
- **Muted Ink** (#8a8a8a): Secondary text — dates, units, labels, helper copy. Passes 4.5:1 on both #0a0a0a and #141414; never use anything dimmer for readable text.

### Named Rules
**The One Accent Rule.** #d4d4d4 appears only on the primary action of the current screen and as the chart stroke. If two elements on one screen are accent-filled, one of them is wrong.

**The Locked Palette Rule.** These six values are the entire palette. No new grays, no tints, no hue anywhere. State changes (hover, press, disabled) move within this ramp — they never introduce color.

**The Plate Exception Rule.** The single sanctioned use of hue: plate chips and the loaded-bar illustration in the weight picker carry muted versions of real gym plate color conventions (blue #5b7d9e, yellow #a08f56, green #5f8a6e, red #9e6060, white #c2c2c2, black #6e6e6e, silver #98989f). These are recognition aids that mirror physical reality, never decoration, and they appear nowhere else in the interface.

## 3. Typography

**UI Font:** Inter (with system-ui fallback)
**Data Font:** Inter with `font-variant-numeric: tabular-nums`

**Character:** One family carries everything. Headers are tight-tracked and confident; body copy gets generous line-height; numbers are set in tabular figures so columns of weights and reps align like a ledger.

### Hierarchy
- **Headline** (600, 1.5rem, 1.2, -0.02em): Screen titles ("Push", "Trends"). One per screen.
- **Title** (600, 1.125rem, 1.3, -0.01em): Exercise names, section headings.
- **Data** (600, 1.25rem, 1.2, tabular-nums): Weights and reps — the current set's values, history rows. The largest recurring text on /today.
- **Body** (400, 0.9375rem, 1.6): Helper copy, empty states. Max 65ch.
- **Label** (500, 0.8125rem, 1.4): Field labels, units ("kg", "reps"), axis labels, dates. Muted ink by default. Never uppercase-tracked eyebrow style.

### Named Rules
**The Ledger Rule.** Every numeral that can be compared to another numeral is set in tabular figures. Misaligned digit columns are a bug.

## 4. Elevation

Content stays flat: two-step surface ramp (#0a0a0a → #141414) plus a 1px #232323 border. Floating chrome uses frosted glass (`backdrop-filter: blur(18px)`) with a light translucent border and a soft umbra (`0 8px 28px rgba(0,0,0,0.45)`). Drag-in-progress rows may keep the subtle 1–2px umbra.

### Named Rules
**The Hairline Rule.** Content surfaces get a 1px #232323 border. If a border isn't enough, the layout is wrong — not the shadow budget.

**The Glass Chrome Rule.** Blur and translucent fills are allowed only on elements that float above the page (nav, overlays, mid-workout controls). Never frost exercise cards, lists, or charts.

## 5. Components

Component vocabulary is small and identical on every screen. Content corners are 8px; floating chrome and mid-workout controls use pill (999px) or 20px radii.

### Buttons
- **Shape:** Primary log actions and glass controls use pill radius on mobile; content-adjacent controls may stay 8px. Minimum 44px tall for mid-workout controls.
- **Primary:** Off-white accent fill (#d4d4d4) with near-black text (#0a0a0a). One per screen.
- **Hover / Focus:** Primary brightens to #fafafa; focus is a visible 2px outline in #fafafa offset from the fill. Transitions 150ms ease-out-quint.
- **Secondary (glass):** Translucent fill + light border + blur (`.glass-btn`). Used for steppers, "Same as last time", timer adjustments.
- **Disabled:** Surface fill, muted-ink text, no border dimming tricks.

### Steppers
The signature control. A weight/reps stepper is a horizontal group — minus button, tabular-figure value, plus button — each target ≥44px. Buttons are circular glass discs; the value is Data type. Press feedback is a brief scale-down (0.96) plus highlight shift; suppressed under `prefers-reduced-motion`.

### Cards / Containers
- **Corner Style:** 8px for content cards.
- **Background:** #141414, always with a 1px #232323 border. Not glass.
- **Shadow Strategy:** None at rest on content cards.
- **Internal Padding:** 16px (24px on desktop where content breathes).
- Cards are used only when grouping is real (one exercise's logging block). Never nested, never as decoration.

### Inputs / Fields
- **Style:** #0a0a0a fill, 1px #232323 border, 8px radius, ink text. Rare by design — steppers replace typing.
- **Focus:** Border shifts to #8a8a8a plus a visible outline. No glow.

### Navigation
- **Mobile:** Floating pill tab bar above the safe area — frosted glass, icon + label per tab, active item seated in a translucent highlight pill. Accent fill stays on the log action, not the nav.
- **Desktop:** Slim sidebar, solid surface, hairline border. Active item: ink text; inactive: muted ink.
- **Cold open:** Logo + wordmark hold ~900ms, then blur-fade into the shell (once per browser session). Skip under reduced motion.

### Rest Timer (signature component)
Floating glass chip above the mobile nav. Subtle progress ring, 1.5px stroke in #d4d4d4 on a #232323 track, tabular-figure countdown centered. Dismissible with one tap. Under `prefers-reduced-motion`, the ring is replaced by the numeric countdown alone.

### Charts
Thin 1.5px lines in #d4d4d4, no gridlines, no area fills, no dots except the latest point, minimal muted-ink axis labels. A chart is an instrument for reading a trend, not a decoration.

## 6. Do's and Don'ts

### Do:
- **Do** keep exactly one accent-filled primary action per screen — everything else is surface or glass secondary.
- **Do** prefill last session's weight×reps and make adjustment stepper-only; zero required typing for a normal set.
- **Do** keep content cards solid + hairline; reserve frosted glass for floating chrome and mid-workout controls.
- **Do** set all comparable numerals in tabular figures.
- **Do** write copy that states facts: "3 sets logged", "No sessions yet — defaults below", never praise or hype.
- **Do** honor `prefers-reduced-motion` on every animation, including the rest-timer ring and boot splash.

### Don't:
- **Don't** use purple gradients, gradient text, or any gradient anywhere — the palette is grayscale plus the Plate Exception.
- **Don't** frost content cards, lists, or charts — glass is chrome only.
- **Don't** use the "ai-color-palette" (indigo/violet/cyan) or introduce any hue outside the Plate Exception Rule (muted plate-convention tints, weight picker only).
- **Don't** use side-stripe borders (`border-left` > 1px as a colored accent) on cards, rows, or callouts.
- **Don't** build the generic shadcn dashboard look: no identical card grids, no hero-metric tiles, no ghost cards.
- **Don't** add gridlines, area fills, or multi-color series to charts; 1.5px single-accent lines only.
- **Don't** ship motivational copy, streaks, badges, emoji, or celebration motion of any kind.
