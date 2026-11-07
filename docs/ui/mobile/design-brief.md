# Mobile UI design brief

**Status:** Round 7 review in progress

**Scope:** Responsive web experience for phones and tablets; no native-app behavior. The first implementation is on `ui/mobile`.

## Product and people

Crawler brings jobs from five hiring platforms into one searchable index. The primary user is a job seeker checking opportunities in short sessions on a phone, often with one hand and an inconsistent network. They need to quickly find a relevant role, judge whether it is worth opening, save it for later, and follow the original apply link.

The user should leave each session with one of three outcomes: a useful role opened, a role saved locally, or a search narrowed with filters that can be adjusted without losing their place.

## Product world

- **Domain:** career discovery, role fit, hiring sources, location, employment terms, recency, and a browser-local Saved shelf.
- **Color world:** pale mist and paper-like neutral surfaces; deep ink for readable titles; a restrained pale-teal accent for focus and saved state; provider colors as labeled source markers; red reserved for errors and unavailable roles.
- **Signature:** the **local saved shelf**—a one-tap save action on a source-identified job card, followed by an immediately available Saved destination with a count. Saved roles remain in this browser profile only; they are not synced or confidential.
- **Visual character:** calm, focused, and editorial rather than a high-density job board. Preserve the existing light/dark theme and teal primary accent. Job content, not decoration, carries the visual weight.

## Defaults to reject

1. **Desktop sidebar stacked above mobile content** → compact mobile navigation that stays available without consuming the first screen of results.
2. **All job metadata given equal prominence** → lead with role and company, then location and freshness; put secondary employment, workplace, and provider information on a quieter metadata line.
3. **A generic long filter form with unclear commit behavior** → a titled filter sheet with staged changes, visible active-filter count, explicit Apply, and predictable Cancel/Reset behavior.

## Information architecture

1. **Explore** is the default destination and the primary job-finding surface.
2. **Saved** is a peer destination for locally stored roles, clearly labeled as device-local.
3. **Search** is available from the list header in both destinations.
4. **Filters** are secondary to search and open in a sheet or dialog appropriate to viewport size.
5. **Job card** exposes the role summary, Save/Remove, and the original Apply/View link. Full description stays collapsed until requested.

On phones, Explore and Saved use a persistent bottom navigation bar. Pad the scrollable page by the navigation height plus safe-area inset so the final card and pagination can scroll fully above it. At 768–1023 px, use a compact top destination switcher and keep the result list centered. At 1024 px and above, retain the existing sidebar navigation and filters.

## Composition and hierarchy

- Keep a single-column stream of job cards at all mobile and tablet widths. Avoid a two-column card grid that makes role titles and metadata scan poorly.
- Place a compact product header first, followed by a full-width role/keyword search field. Put the result count and Filters control on one row below it.
- Keep location in Filters below 1024 px. Show it inline beside role search in the desktop layout.
- Within each card, order content as: company and provider identity; role title; location and posting date; employment/workplace details; optional tags; collapsed job brief; Save and Apply/View actions.
- Use a persistent bottom navigation on phones only. Keep the primary card action in normal document flow; do not pin a global Apply action over scrollable content.

## Responsive contract

| Viewport width | Navigation | Search and filters | Results |
| --- | --- | --- | --- |
| 320–479 px | Fixed bottom Explore/Saved bar with safe-area inset | Single role-search field; location and all refinements in filter sheet | One-column cards; actions may wrap to a second row |
| 480–767 px | Same bottom bar | Full-width role search; location and refinements in filter sheet | One-column cards; actions remain at least 44 px high |
| 768–1023 px | Compact top Explore/Saved switcher | Role search; location and refinements in a side sheet/dialog | Centered one-column list with a readable maximum width |
| 1024 px and above | Existing desktop sidebar pattern | Existing inline sidebar filters and full search row | Existing desktop card layout |

Test at 320, 360, 390, 430, 479, 480, 767, 768, 820, 1023, 1024, and 1280 CSS pixels. No horizontal page scroll is permitted. Browser zoom, safe-area insets, dynamic text, and the on-screen keyboard must not cover an active control or the sheet's primary action.

## Visual system constraints

- Reuse semantic theme tokens from `app/globals.css`; the mobile spec does not introduce a second palette or hard-coded color values.
- Keep current light/dark mode behavior. Contrast and focus indicators must pass in both themes.
- Use the existing system-font stack and typography hierarchy. Prefer weight and color contrast over extra type sizes.
- Continue the restrained surface-and-border depth strategy; reserve stronger contrast for the active destination, focus, saved state, and errors.
- Use a 4 px spacing base: 16 px page gutters below 480 px, 20 px from 480–767 px, and 24 px at tablet width; use 12 px between cards and 16 px internal card padding.
- Keep job titles at 18 px / semibold on phones, company at 14 px / semibold, and metadata at 12–14 px. Avoid making essential provider, employment, date, and workplace text smaller than 12 px.
- Phone bottom navigation is at least 56 px tall plus the bottom safe-area inset. Filter-sheet content scrolls independently; a pinned footer stays visible above the keyboard.
- Card and sheet density should feel comfortable at phone width, not like scaled-down desktop controls.
- Respect `prefers-reduced-motion`; sheets may move a short distance when opening but must remain understandable without motion.

## Non-goals

- Native iOS/Android navigation, gestures, offline job search, account creation, bookmark synchronization, or changes to the job API.
- Infinite scrolling, swipe-to-dismiss job cards, and hidden gesture-only actions.
- Redesigning the desktop experience beyond any changes required to keep responsive behavior coherent.

## Design review questions

- Can a first-time user reach an interesting role without understanding the filter system?
- Can a returning user find a saved role with one predictable destination change?
- Does the local-storage boundary remain explicit at the point where a user saves or visits Saved?
- Can users operate search, filters, cards, and navigation with touch, keyboard, and assistive technology?
