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
    fontFamily: "SF Pro, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "SF Pro, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "SF Pro, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "0"
  label:
    fontFamily: "SF Pro, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0"
  data:
    fontFamily: "SF Pro, system-ui, sans-serif"
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

MIRIN looks like a precise instrument, not an app trying to impress. The entire surface is a near-black field (#0a0a0a) on which numbers — weights, reps, trends — are the only stars. There is one accent, and it isn't a color: it's off-white (#d4d4d4), reserved for the single primary action on each screen. Everything else is grayscale hierarchy: bright ink for the data that matters, muted ink for context.

Glassmorphism is the interactive language: frosted panels, specular glass buttons, and press-scale feedback on nav, steppers, toggles, and secondary actions. This system rejects purple gradients, gradient text, ghost cards, side-stripe borders, identical card grids, and fitness-app hype. It is used mid-workout, one-handed, between sets — so density is moderate, tap targets are large, and each screen has exactly one primary action.

**Key Characteristics:**
- Near-black monochrome with a single off-white accent for primary actions
- Frosted glass for interactive chrome and exercise panels; solid accent for the one primary action
- Tabular-figure numerals as the visual centerpiece
- 8px spacing grid, generous whitespace, one primary action per screen
- Charts as thin instruments: 1.5px lines, no gridlines. On Profile the volume series is the exercise quote behind the figure — green when the window rose, red when it fell
- Brief logo hold on cold open, then reveal the task (once per session)

## 2. Colors

A locked grayscale palette; hierarchy is carried entirely by lightness, never by hue.

### Primary
- **Off-White Accent** (#d4d4d4): Fill of the one primary action per screen (the log check, and any other confirm control). Also the stroke of body-metric charts. Its rarity is what makes it read as an accent.

### Neutral
- **Near-Black** (#0a0a0a): The body background everywhere. Near-black, not pure black — it keeps hairline borders and surfaces legible.
- **Surface** (#141414): Fallback when backdrop-filter is unavailable; rare opaque panels.
- **Hairline** (#232323): 1px borders on inputs and non-glass dividers.
- **Glass** (rgb(20 20 20 / 0.55) + 20px blur): Nav, overlays, exercise panels, segmented tracks, secondary controls.
- **Ink** (#fafafa): Primary text — exercise names, logged numbers, headings.
- **Muted Ink** (#8a8a8a): Secondary text — dates, units, labels, helper copy. Passes 4.5:1 on both #0a0a0a and #141414; never use anything dimmer for readable text.

### Named Rules
**The One Accent Rule.** The accent appears only on the primary action of the current screen and as the stroke of a chalk chart. Chalk is #d4d4d4 in dark and #1a1a1a in light. If two elements on one screen are accent-filled, one of them is wrong. The Quote Exception is the other stroke: green or red for direction, never a second filled button.

**The Locked Palette Rule.** The default log is these values. No extra grays, tints, or hue on the logging surfaces themselves. State changes (hover, press, disabled) move within the ramp.

**The Appearance Rule.** Profile sets mode inline: the word System, and Light and Dark as sun and moon glyphs. The selected glyph fills from its outline with the same center bloom as the tab bar; a press starts that fill immediately. There is no appearance subpage and no palette picker. Light is the paper inverse (`#f3f2ef` ground, `#161616` ink, `#5c5c58` muted). The accent stays Chalk — off-white in dark, near-black in light. Text on that accent is `--color-on-accent`. Nothing else gains a second hue. The Plate Exception and the Reel Spectrum are unchanged.

**The Plate Exception Rule.** Plate chips and the loaded-bar instrument in the weight picker — 2D chips and the 3D plate bodies alike — carry gym plate color conventions (blue #1f4fa3, yellow #f2c500, green #1e8c4a, red #d22a2a, white #f2f2f2, black #6e6e6e, silver #98989f). These are recognition aids that mirror physical reality, never decoration, and they appear nowhere else in the interface.

**The Reel Spectrum Rule.** While a finger is on the live weight or reps, only that number leaves the steel. Its score is its own: weight against this lifter's two weights, reps against the two rep counts. The other number stays ink. Sand is the working value they would be repeating. Green is the double-progression prescription, and it is a solid green only when both numbers sit on that set. Between the anchors, and anywhere short of an exact match, the glyph is a gradient. A value lighter than both, or heavier than both, moves through rose into a solid red. The color leaves with the finger. Warm-ups and a lift with no working history stay ink. The wash appears nowhere else: not on the ledger, the rest clock, or Drop.

## 3. Typography

**UI Font:** SF Pro (with system-ui fallback). The variable face carries weight and optical size, the same family the Stocks app and the iOS 27 UI kit use.
**Data Font:** SF Pro with `font-variant-numeric: tabular-nums`

**Character:** One family carries everything. Headers are tight-tracked and confident; body copy gets generous line-height; numbers are set in tabular figures so columns of weights and reps align like a ledger.

### Hierarchy
- **Headline** (600, 1.5rem, 1.2, -0.02em): Screen titles ("Push", "Trends"). One per screen.
- **Title** (600, 1.125rem, 1.3, -0.01em): Exercise names, section headings.
- **Data** (600, 1.25rem, 1.2, tabular-nums): Weights and reps — the current set's values, history rows. The largest recurring text on /today.
- **Body** (400, 0.9375rem, 1.6): Helper copy, empty states. Max 65ch.
- **Label** (500, 0.8125rem, 1.4): Field labels, units ("kg", "reps"), axis labels, chart dates. Muted ink by default. Never uppercase-tracked eyebrow style.
- **Today date** (600, 1.25rem, 1.15, -0.022em): Month and day under the day name, the same cap size as that name, semibold, in secondary gray (#8e8e93 in dark). Not the label style.

### Named Rules
**The Ledger Rule.** Every numeral that can be compared to another numeral is set in tabular figures. Misaligned digit columns are a bug.

## 4. Elevation

Depth comes from frosted glass: translucent fill, light border, inset specular highlight, and a soft umbra on floating elements. Opaque surface + hairline remains the fallback when blur is unavailable. Drag-in-progress rows may keep a subtle 1–2px umbra.

### Named Rules
**The Glass Rule.** Interactive surfaces and exercise panels use `.glass` / `.glass-btn`. Charts stay unfrosted instruments — glass belongs to controls and containers, not data ink.

## 5. Components

Component vocabulary is small and identical on every screen. Content corners are 8px; floating chrome and mid-workout controls use pill (999px) or 20px radii.

### Buttons
- **Shape:** Primary and glass controls use pill radius on mobile; minimum 44px tall for mid-workout controls.
- **Primary (`.btn-primary`):** Off-white accent fill (#d4d4d4) with near-black text. One per screen. Light press scale (0.98).
- **Secondary (`.glass-btn`):** Frosted disc/pill with inset specular edge, blur, and press scale (0.94). Steppers, timer adjustments, icon buttons.
- **Segment chips (`.glass-chip`):** Sit inside a `.glass` track; active chip uses `.glass-chip-active`.
- **Disabled:** Opacity 0.4; no press transform.
- **Motion:** 160–200ms ease-out-quint; suppressed under `prefers-reduced-motion`.

### Steppers
The signature control. A weight/reps stepper is a horizontal group — minus button, tabular-figure value, plus button — each target ≥44px. Buttons are circular `.glass-btn` discs; the value is Data type.

### Cards / Containers
- **Corner Style:** 8px or 20px for glass panels.
- **Background:** `.glass` for exercise tiles and interactive panels.
- **Internal Padding:** 16px (24px on desktop where content breathes).
- Cards are used only when grouping is real (one exercise's logging block). Never nested, never as decoration.

### Inputs / Fields
- **Style:** #0a0a0a fill, 1px #232323 border, 8px radius, ink text. Rare by design — steppers replace typing.
- **Focus:** Border shifts to #8a8a8a plus a visible outline. No glow.
- **Auth fields:** Email, password, and the sign-up name are a writing line, not a box. Transparent fill, no radius, a single hairline along the bottom. Focus is the caret alone — the line does not brighten and no outline is drawn. Browser autofill keeps a flat ground close to the page.

### Navigation
- **Mobile:** Floating pill tab bar above the safe area — frosted glass, icon-only tabs, active item seated in a translucent highlight pill. Selected icon fills solid ink from the outline (a center bloom); inactive stays outline. Accent fill stays on the log action, not the nav.
- **Desktop:** Slim sidebar, solid surface, hairline border. Active item: ink text and a filled icon; inactive: muted ink and outline.
- **Cold open:** Logo mark alone holds ~900ms, then blur-fade into the shell (once per browser session). Skip under reduced motion.

### Rest Timer (signature component)
Floating glass chip above the mobile nav. Subtle progress ring, 1.5px stroke in #d4d4d4 on a #232323 track, tabular-figure countdown centered. Dismissible with one tap. Under `prefers-reduced-motion`, the ring is replaced by the numeric countdown alone.

### Charts
Thin lines, no gridlines, minimal muted-ink axis labels. A chart is an instrument for reading a trend, not a decoration. Body metrics stay a chalk line. Profile volume and the exercise quote share one chart: a monotone curve, a wash, trailing ticks, three dates, a range row, and a scrub. The Quote Exception is that chart.

### Exercise quote
The estimated 1RM for one lift, read like a stock price. It sits below the log on Today, for the exercise in front, and it is the whole exercise page. The same chart is the profile volume reading, with the figure standing in the plot. On a phone the log keeps the first viewport above the tab bar; the page then scrolls natively into the quote. Order: lift name (title) with the muscle muted beside it, a muted "Estimated 1RM" label, the estimate in ink at 2.125rem/600 with the unit muted, then one line with the signed change and percent in tone and the window in muted ink ("Past 3 months"). The plot is 13.5rem tall on Today and 18rem on Profile, a monotone curve at 1.75px over a wash that fades from 34% to 0 across the plot height, y ticks in 11px muted figures on the trailing edge, and three dates at even time fractions. A pointer resting on the line reads the nearest session: a muted vertical rule, a dot ringed in ground, and the readout switches to that session's value, its change from the window start, and its date. Vertical intent still scrolls the page. On Profile, a drag that starts on the figure still turns it; a drag that starts on the chart reads the session. Under the plot, the windows 1W, 1M, 3M, 6M, YTD, 1Y, 2Y, 5Y, All sit in one row; the selected window is the line's tone. Sessions follow as hairline rows: the sets, the plate breakdown muted beneath, the date on the trailing edge. On Profile the selected region's exercises follow the same way: the name, the volume on the trailing edge.

**The Quote Exception Rule.** On the quote, the window's direction is color: green (#30d158, light #1f8a3a) when the series rose, red (#ff453a, light #d70015) when it fell, muted when flat. The hue reaches the change, the line, the wash, and the end dot; the headline number stays ink. Profile volume uses this rule. The same two pigments mark recent direction beside the Today exercise title: a short diagonal arrow, up-right when the last two prior sessions rose and down-right when they fell, absent when the move is flat or there is only one print. The arrow's text equivalent names the direction, and the quote's change always carries a sign, so color is never the only signal. Body-metric charts stay chalk.

### Today exercise frame

Exercises on Today share one fixed frame, the way a multi-photo post keeps one box. A horizontal swipe anywhere on Today translates the stage inside that frame — name and instrument — including the reading below the fold. The estimate and the sessions ride the same gesture. A drag on the chart reads the session under the finger, and the range words scroll on their own. The figures keep their own sideways swipe for Drop, and the logged-set line keeps its scroll. On a phone the frame is the flexible slot between the day header and the thumb dock. Its height does not change from one exercise to the next; a taller stage scrolls inside the page. Logged sets for the exercise in front are one horizontal line, one row tall. On a phone that line sits at the top of the bottom half, and the row is reserved before the first set so the figures do not move. The newest set is at the trailing end. Once the line overflows, earlier sets fade at the leading edge and the line scrolls. A token is the pair only, such as 170×7. Warm-ups stay muted. A drop continues its set, such as 170×7 → 140×10. Tap a token to edit that pair — drag a number or type it — and one minus removes it; a horizontal swipe on the token removes it too. Logging prints the pair from the figures into the line. The figures keep the same numbers. Reduced motion appends the token in place. The weight and the reps are separate reels: a vertical swipe tracks the thumb, the next value peeks in above or below, and release snaps to the detent without logging. The numerals are satin under the same studio light as the bar: a smooth metallic fall from the top of each stroke, clipped to the glyph, with no outline and no shadow. During that swipe the metal takes the Reel Spectrum tint, and both numerals are the resting steel again once the finger lifts. A tap logs. A long-press types a value. A sideways swipe still reaches Drop. While a rest counts down, the figures give way to the time, and a 1.5px accent hairline under the line shows what remains. On a wide layout, once the swipe settles the frame is the active page, and during the gesture it is the taller of the two so neither clips. Every page is the real stage, already painted, so the incoming exercise does not appear as a placeholder first. On a phone, weight, reps, and Log leave the stage and sit as one line of chromeless figures centered in the bottom half, just above the tab bar and clear of the home indicator. The instrument fills the slot above those figures. No surface and no outline — the numbers are the control. The instrument stays in the frame. On a wide layout the same figures — weight, reps, and log — stay one gap under the instrument, and the one-line ledger stays with that exercise, above the instrument. A sideways swipe on the figures still reaches Drop. A warm-up, when that is the set being logged, is named once above the line. A search mark sits in the day header, beside the unit. Opening it reveals the field from that mark toward the title, and the results hang from the same corner. The exercise menu's first item opens the same field. Complete workout sits in the thumb dock under the figures once the session is ready to finish.

### 3D weight instrument
The barbell and dumbbell in the weight picker are procedural Three.js models, not mesh files. They sit under one large live weight with no chrome around them. A pair of bells is still one per-hand load: a muted "per hand" gloss sits after the unit. Single has no qualifier. The live weight's chevron opens a glass listbox of bar weights — not a segmented pill. Gym references: urethane circular dumbbell, competition bumper plates on a chrome Olympic bar. Equipment (dumbbell / barbell / custom) is a horizontal pager. The logging screen is the swipe field except the figures' Drop swipe and the logged-set line: a finger drag tracks 1:1 as a hinge-card slide (translate plus a shallow rotateY, scale, and fade), rubber-bands at the ends, and settles with ease-out-expo. Reverse, cancel, and a lost pointer snap from the finger's current page, not the down-point. Reps are one compact inline companion under the pager, not a second labeled stepper. The pager height tracks the active page on a wide layout, including during the swipe. On a phone the exercise frame is the flexible slot above the thumb dock, so that pager does not resize it from one exercise to the next. On a wide layout, reps and Log stay one gap below the instrument on every mode. On a phone that row sits in the thumb dock, just above the tab bar. Vertical intent still scrolls the page or steps the dumbbell rack. Arrow keys on the focused card change method too. On barbell, plate chips sit immediately under the bar.

- **Camera:** fixed perspective, parked on the object's midline and looking slightly down the shaft so a disc reads as an ellipse (~0.23 of plate height on the bar, ~0.20 on the dumbbell's outer face). Distance is the pose; only FOV reacts to the element's size. The bar is fitted to a constant 45 cm envelope, so adding or removing plates never changes its size on screen. A tap on the model opens the variation list over the instrument; a second tap on the model, or a tap outside the list, closes it. The model does not orbit and does not change the load. On every equipment, a vertical drag on the live weight number changes the load, heavier toward the top of the screen, and a vertical drag on the reps number changes the count. A long-press on either number types a value. A tap on the figures logs the set. The drag is a reel: the digit tracks the finger, the next value peeks in, and release snaps to the detent. The model only shows the result. A drag that starts sideways still pages. Horizontal paging is owned by the open exercise card, not the 3D object. Outside that weight number, vertical scroll still owns the page. `prefers-reduced-motion` holds the rest pose and crossfades equipment instead of sliding. A tap on a plate still removes it.
- **Lighting:** grayscale key / fill / rim plus a PMREM-filtered studio environment (overhead softbox). No HDRI file, no hue in the lights.
- **Materials:** mirror chrome shaft and handle; diamond knurl (albedo + bump); matte urethane heads with the selected weight stamped on the outer faces; bumper plates pull hue only from the Plate Exception swatches. Plate faces share the chip drawing — raised outer lip, hub flange, Olympic chrome insert, and 3/9 weight numerals — so the loaded bar and the plate controls are the same bumper. The bar, the bells, and the cable clips are code-only — no `.glb`. Canvas numerals are generated at runtime from the selected weight. Cable work other than the seated row shows the clip on the stack: straight bar, EZ bar, close-grip row handle, rope, or stirrup. Polished chrome, ribbed black grips, a vertical eyelet, and — on the rope — a braid and two solid balls. The lifter picks the clip under the model; the choice is remembered on the exercise. Selectorized stations are one decimated model in satin steel (`#c4c4c8`, no hue), parked under the number. Lat pulldown shows the pulldown station. Seated cable row shows that station, not a clip. Lying leg curl (the seeded Leg Curl) shows the bench, the roller, and the stack. Pec deck (Butterfly) shows the seat, the pads, and the stack. Leg press is the 45° plate-loaded sled with its seat and rails. Standing calf raise shows the shoulder pads, the stack, and the toe platform. Lying T-bar row shows the chest pad, the handles, and the footplate. Leg extension shows the seat, the back pad, and the roller. Inner thigh (Thigh Adductor) and outer thigh (Thigh Abductor) show their seats, thigh pads, and stacks. The preacher curl machine shows the arm pad, the seat, and the stack. The seated dip shows the back pad and the handles. The shoulder lateral raise shows the seat and the arm pads when that lift is logged on a machine. Leg press, calf raise, T-bar row, lateral raise, and preacher match machine work only; barbell, dumbbell, and Smith variants keep their own instruments. A vertical drag on the weight number steps the stack by the manual increment. The reps number has its own drag. The station itself does not. Other machines stay on the stepper alone. The plate-loaded chest press is procedural rather than a mesh file: dark powder-coat frame, satin-steel arms, black pads, and one plate on each horn, turned so the stage camera sees the same three-quarter the other stations use. Maker marks from the reference photos are not copied. A custom exercise set to Machine names its station with a still of that mesh, scaled to the cell. The grid lists only the stations for the selected muscle. That choice picks the model on the stage, and the typed name is only a fallback until the lifter taps one.
- **Motion:** plates settle onto the sleeve in 160ms ease-out-expo. Equipment pages track the finger as a hinge-card slide, then settle in ~380ms ease-out-expo; reverse, cancel, and a lost pointer snap from the visual page. During the slide, live WebGL is frozen to a still so the CSS 3D hinge does not blank the instruments. Reduced motion skips the slide. Under `prefers-reduced-motion`, plates appear in place and tilt is off.
- **Fallback:** reserved stage height when WebGL is missing or the 3D chunk fails. Inactive pager pages keep the 3D scene and show a still of it — never the retired SVG line-art. Pair vs single is the same object count.
- **Role:** a mid-workout picture of the load. The dumbbell, the bar, the clip, and the station do not take a drag. A tap opens the variation list for that lift. Weight and reps change from the numbers: drag up to raise either one, or long-press it to type. A tap logs. The row under a cable still names the other clips. Barbell plates still come from the chips, and the weight number writes the same stack. A custom machine that names a station uses that mesh; other custom and unnamed machine work keeps the number alone. Switching a lift to Machine opens the same station stills, filtered to that lift: a rear-delt fly offers the pec deck and the back stations. Scroll still owns the page outside those frames.

## 6. Do's and Don'ts

### Do:
- **Do** keep exactly one accent-filled primary action per screen — everything else is glass secondary.
- **Do** prefill last session's weight×reps so Log is already "same as last time"; adjust only to deviate — drag either number, or long-press it to type. A tap logs the set. Chips still load a bar.
- **Do** use frosted glass + press feedback on interactive controls; keep charts unfrosted.
- **Do** set all comparable numerals in tabular figures.
- **Do** write copy that states facts: "3 sets logged", "No sessions yet — defaults below", never praise or hype.
- **Do** honor `prefers-reduced-motion` on every animation, including glass press scales, the rest-timer ring, and boot splash.

### Don't:
- **Don't** use purple gradients, gradient text, or hue gradients — the palette is grayscale plus the Plate Exception. The one other wash is the Reel Spectrum, and only on the live numerals while a finger is down.
- **Don't** use the "ai-color-palette" (indigo/violet/cyan) or introduce any hue outside the Plate Exception, the Reel Spectrum, and the Quote Exception. The accent stays Chalk.
- **Don't** use side-stripe borders (`border-left` > 1px as a colored accent) on cards, rows, or callouts.
- **Don't** build the generic shadcn dashboard look: no identical card grids, no hero-metric tiles, no ghost cards.
- **Don't** add gridlines or a second hue to charts. The exercise quote and profile volume share the Quote Exception: one hue for direction, a wash under the curve, and a sign on the change. Body-metric charts stay chalk.
- **Don't** ship motivational copy, streaks, badges, emoji, or celebration motion of any kind.
