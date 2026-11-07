# Final mobile UI specification

**Status:** Round 7 review in progress

**Version:** 0.6

**Scope:** Mobile and tablet responsive web UI for Crawler's existing job browser. The first implementation is on `ui/mobile`; this specification remains a proposal until all three council scores reach 9/10.

## Decision summary

- Design a phone-first responsive web experience for job discovery, saved roles, search, and filtering.
- Preserve the current visual identity: semantic neutral surfaces, light/dark themes, system-font stack, and pale blue-green primary accent.
- Optimize for a short job-seeker session and one-handed reach. Make role discovery and Save/Apply actions direct; place advanced refinements behind a clear, reversible filter sheet.
- Saved roles are local to the current browser profile. Avoid wording, sync icons, or navigation that suggests account-level privacy or cross-device access.
- Use one result column at all phone/tablet widths and existing desktop behavior at 1024 px and wider.

## Product world and visual intent

**Domain concepts:** hiring sources, role fit, company, location, employment terms, recency, and a browser-local Saved shelf.

**Color world:** quiet neutral “paper” surfaces, deep ink, a pale teal accent for active/saved states, provider colors used as labeled source markers, and red limited to error/unavailable states.

**Signature:** a local Saved shelf, reachable from the phone's bottom navigation with an optional count, paired with a visible source label on every role.
**Direction:** calm, editorial job discovery; the card hierarchy should let a user scan role and company first, then decide whether to save or open the source listing.

The shelf is stored in this browser profile only; it is not synced or confidential. Keep the system's restrained accent treatment and do not imply account-level privacy.

Reject desktop-sidebar stacking on phones, same-weight metadata, and a long unstructured filter form. Replace them with persistent phone destinations, a clear role-first card, and a filter sheet with explicit draft/apply/cancel semantics.

## Navigation and viewport contract

| Width | Destination navigation | Search/filter arrangement | Content |
| --- | --- | --- | --- |
| 320–479 px | Fixed bottom Explore/Saved bar; hide visual count at zero, cap visual badge at `99+` | Full-width role search; location and refinements in the filter sheet | Single-column cards; actions can wrap |
| 480–767 px | Same bottom bar; same count behavior | Full-width role search; location and refinements in the filter sheet | Single-column cards |
| 768–1023 px | Compact top Explore/Saved switcher | Role search; location and advanced refinements in a side sheet/dialog | Centered, single-column list |
| 1024 px+ | Existing desktop sidebar | Existing desktop search and inline sidebar filters | Existing desktop card layout |

Support widths 320, 360, 390, 430, 479, 480, 640, 767, 768, 820, 1023, 1024, and 1280 px. At every size, avoid horizontal page scroll and ensure safe-area, dynamic viewport, keyboard, zoom, and text scaling do not hide an active control. Below 768 px, reserve bottom padding equal to the fixed navigation height plus the safe-area inset; at 768 px and wider the phone bar is hidden.
Date inputs have visible After/Before labels; stack them below 360 px and in the desktop sidebar, and use two columns at 360 px and wider in the mobile/tablet sheet.

## Screen composition

1. Compact top header: product identity and theme control.
2. Primary role/keyword search, full width on compact phones.
3. Result summary row with count/range and Filters trigger/count.
4. Optional active-filter chips, wrapping instead of horizontal-scroll-only.
5. One-column results stream; role and company lead, supporting metadata follows.
6. Phone-only bottom Explore/Saved navigation with device-local save count; page content reserves bottom padding for the bar and safe-area inset so its final item and pagination remain reachable above the bar.
7. Normal-flow pagination and job actions; no fixed Apply overlay.

Cards order information as company + labeled provider, role title, location/date, employment/workplace, optional tags, collapsed job brief, then Save and Apply/View. Do not truncate role titles or make the whole card an unmarked link.

## Spacing and type

- Use the current system-font stack and semantic theme tokens; do not introduce a new font or palette.
- Use a 4 px spacing base: 16 px page gutters below 480 px, 20 px from 480–767 px, and 24 px at tablet width. Cards are separated by 12 px and use 16 px internal padding.
- Phone job titles are 18 px semibold, company names 14 px semibold, and essential metadata 12–14 px. Do not reduce provider, date, workplace, or employment text below 12 px.
- Phone bottom navigation is at least 56 px tall plus the bottom safe-area inset. The filter-sheet footer remains pinned above both the safe area and software keyboard.
- Continue the existing soft surface and semantic-border treatment; keep teal for purposeful active/saved states and avoid decorative color or gradient use.

## Interaction contract

### Search and destination changes

- Search is available in both Explore and Saved. Keep query text visible during loading and failure; clear affects only the query. Debounce Explore edits by 250 ms; Enter submits immediately without page reload.
- When description search is enabled, require all of the first eight alphanumeric query terms as whole tokens; Explore and Saved use the same rule. Title, company, and location use case-insensitive substring matching.
- Location remains in the filter sheet below 1024 px and sits inline beside role search at 1024 px and wider.
- Explore uses a 250 ms debounce for edits and bypasses it on Enter; Saved filters its validated local snapshot immediately. Only the latest Explore request may update results, count, error, or page; abort and ignore stale responses when query, filter, page, or destination changes.
- Switching Explore/Saved resets pagination to page 1, preserves the query and applied filters, scrolls the list to the top, focuses the result summary, and announces the destination and current result count. Do not steal focus on initial load.
- Destinations are `<nav>` buttons with `aria-current="page"`, not ARIA tabs. The open filter sheet covers navigation; resizing to desktop closes the sheet and discards the unapplied draft.
- The active destination is communicated using label plus selected semantics, not color alone.

### Theme

- The theme button immediately toggles light/dark, labels the next action, and persists the explicit preference locally. If no explicit choice exists, follow system preference.
- Theme changes do not reset page state and do not close an open filter sheet.

### Filters

- Below 1024 px, Filters opens a titled sheet with location, provider, employment, workplace, posted-after/before dates, and “Search within description.” At desktop width, location is inline and the sidebar contains the remaining filters.
- The tablet sheet is right-aligned and 26 rem wide. Provider, employment, and workplace are single-select; options are Provider: All/Ashby/Greenhouse/Lever/Lever EU/Workable; Employment: Any/Full-time/Part-time/Contract/Internship; Workplace: Any/Remote/Hybrid/On-site.
- Keep date inputs visibly labeled **After** and **Before**. Stack them below 360 px and in the desktop sidebar; use two columns from 360 px in the mobile/tablet sheet.
- Date bounds are inclusive ISO calendar dates based on `first_published`. Explore compares UTC calendar dates; Saved compares the first 10 characters of each stored ISO timestamp. Empty metadata never matches an active field filter.
- The sheet uses draft state. Apply commits all draft fields atomically, resets to page 1, closes the sheet, and focuses the result summary. Cancel, Escape, close, or backdrop dismissal discards edits.
- Reset clears the draft but does not apply it. Invalid date ranges show inline error and block Apply until corrected.
- The trigger shows a count badge only when at least one filter is active; its accessible name always includes the count, including zero (“Filters, 0 active”). Individual applied chips can remove only their corresponding filter and refresh results.
- All phone/tablet selector triggers meet the 44 × 44 px touch-target contract, not only the containing filter field.
- Count each non-empty filter field once: location, provider, employment, workplace, posted-after, posted-before, and description search. Query text has a removable chip but is not included in the filter count. The two date bounds count independently; every field has one chip.
- Focus moves into the sheet, remains trapped there, and returns to the opener when the sheet closes. Background scrolling is locked; the sheet footer stays above the keyboard and safe area.
- Inline desktop filters keep their current live-apply behavior; applied values remain consistent when resizing between inline and sheet layouts.
- If a viewport resize opens the desktop layout while a modal sheet is open, close it and discard the unapplied draft; preserve the already-applied filters.

### Cards and Saved

- Save is a 44 × 44 px button with title-specific accessible name and `aria-pressed`. It writes the current job snapshot to browser local storage and immediately updates card state, Saved content, and count.
- Success announcement says the role was saved “on this device.” Remove is immediate and updates the same local list.
- Changes from another tab in the same browser update the Saved list and count; this remains device-local, not account sync.
- When a card is removed from Saved, move focus to the result summary after the list updates; announce removal and the new count. Clamp pagination if removal reduces the page count.
- Storage parse/quota/access errors must not be presented as success. Keep external job navigation available, explain Save is unavailable, and offer Retry plus a confirmed **Clear saved roles** recovery action without silently deleting stored content.
- After a storage error, Retry rereads the store and writes back only the same validated snapshot to verify write access before re-enabling Save. If parsing or access fails, keep Save disabled and preserve the stored value.
- If local data cannot be read, the Saved count is unavailable, not zero. Keep the error visible and do not silently overwrite the stored value.
- The Saved control's accessible name always includes the exact count or states unavailable/loading; its visual badge is hidden at zero and capped at `99+`.
- Valid v1 snapshots are stored under `jobcrawler.bookmarks.v1`; an incomplete or malformed snapshot makes the store unavailable rather than being partially accepted or overwritten. Retain roles until individually removed or explicitly cleared. Clear saved roles requires confirmation and removes only this key.
- Saved roles are local to this browser profile, not confidential or synced. Do not describe the shelf as private.
- Saved shows local role snapshots even if their external application links are no longer available. Preserve the original Apply/View URL only; never invent a fallback.
- Label the action Apply when an apply URL exists and View when only a details URL exists; omit it if both are missing. It opens the original external URL in a new tab with safe opener policy. Use visible link text and provider label.
- Job brief uses a native, keyboard-operable disclosure; opening it does not trigger a card action.

### Results and recovery

- Initial load shows non-interactive skeletons and a busy results region. Reduced-motion mode suppresses sheet/combobox movement, skeleton shimmer, and loading-spinner rotation. Refresh retains the last successful list until new results arrive.
- Search/filter errors retain the current query, applied filters, and last list when possible. Provide a retry action.
- Distinguish no matching roles, no saved roles, no saved roles matching the current search/filters, and no Explore roles for active search/filters. Offer **Clear search & filters** when the current criteria exclude roles.
- Truly empty Saved provides an Explore action and explains that Saved roles live in this browser profile only; they are not synced or confidential. Filtered-empty Saved explains that roles exist and offers **Clear search & filters**.
- Keep explicit Previous/Next pagination, not infinite scroll. Page size is 20 for both destinations; sort newest publication date first, then title case-insensitively ascending. Saved pagination is local; Explore uses the API-reported page/page count and retains the last successful page on failure.
- Announce page changes and focus the result summary rather than jumping to the document top. A result-count reduction clamps the current page to the last available page (minimum 1).
- Saved applies the current query and every applied filter locally to validated snapshots. Query is a case-insensitive substring in title, company name, or location; description search requires all of the first eight alphanumeric query terms as case-insensitive whole tokens, matching Explore semantics. Company slug, department, education, and experience are not searched. Location is a case-insensitive substring; provider is exact; employment and workplace are case-insensitive substrings. Empty metadata never matches an active field filter.
- Saved sorting uses `first_published` descending and title case-insensitively ascending. Dates use the first 10 characters of the stored ISO timestamp and inclusive bounds.
- Loading, success, empty, unavailable, and error states use text and semantics, not color or motion alone.

## Touch, keyboard, assistive technology

- On phone and tablet touch layouts, primary controls are at least 44 × 44 CSS px for navigation, search, Filters, Save, Apply/View, filter selector triggers, sheet close/clear, and pagination.
- Job-brief disclosures also have a 44 px touch height. Provider identity is text-labeled and does not rely on badge color alone.
- Search inputs use at least 16 px text on phones to avoid browser auto-zoom. Visible labels remain available to assistive technology even if placeholder text is shown.
- Use semantic headings, search form, navigation, dialog, list/article semantics, buttons, links, disclosure, and status regions.
- Provide visible focus in both themes. DOM/tab order follows visual reading order; no hover-only affordance.
- Use a polite status region for loading, result count/range, and page changes; announce save/remove with the existing notification. Use assertive announcement only for blocking errors.
- After Apply, destination selection, pagination, or removal from Saved, focus the result summary. Do not programmatically move focus on initial load.
- Reduced-motion mode removes sheet and combobox movement, skeleton shimmer, and loading-spinner rotation. No critical state is expressed by color or animation alone.

## Measurable acceptance checklist

- [ ] At all target widths and 200% zoom, the page has no horizontal scrolling and controls do not overlap.
- [ ] At 640–767 px, the fixed phone navigation remains clear of the final result and pagination; at 768 px it is hidden.
- [ ] At 320 px, date inputs stack with visible After/Before labels and remain fully operable.
- [ ] Every primary control on phone/tablet touch layouts meets 44 × 44 px; phone search text is at least 16 px.
- [ ] A user can reach a role, save it, open Saved, reload, and confirm the role remains in the same browser.
- [ ] Saved copy and badge identify device-local persistence and never imply account synchronization.
- [ ] Filter edits are reversible until Apply; invalid date range cannot be applied; Reset only edits the draft.
- [ ] Removing one filter chip changes only that filter.
- [ ] Keyboard-only use can reach and operate every control; sheet focus is trapped and restored.
- [ ] Screen-reader output names destinations, controls, result count, saved state, errors, and page changes.
- [ ] Storage failure does not falsely report success or erase data; network failure preserves user input and permits retry.
- [ ] Two deliberately reordered Explore responses cannot let an older query/page replace the newest results.
- [ ] Saved filtering is local and follows the field/missing-metadata contract; page size is 20 and ordering is newest-first/title-ascending.
- [ ] An empty publication date is excluded by either posted-date bound in both Explore and Saved.
- [ ] With description search enabled, Explore and Saved both match all of the first eight alphanumeric terms as whole tokens, independent of word order.
- [ ] Filter count excludes the query chip; one chip maps to each filter field, and date bounds count independently.
- [ ] Malformed storage shows “count unavailable,” never zero; Retry preserves data, while confirmed Clear saved removes only the bookmark key.
- [ ] Destination changes and pagination announce the current destination/count or page and focus the result summary; initial load does not steal focus.
- [ ] Saved's accessible name includes the exact count even when the visual badge is hidden at zero or capped at `99+`.
- [ ] Filters' accessible name includes the active-filter count, including zero; phone/tablet selector triggers are at least 44 × 44 px.
- [ ] Saved with existing roles excluded by the current search/filters offers **Clear search & filters**; only truly empty Saved offers Explore and the local-storage disclosure.
- [ ] With the search keyboard open, dismissing it makes the fixed destination bar reachable without clearing the focused query.
- [ ] Reduced motion suppresses sheet/combobox movement, skeleton shimmer, and spinner rotation; 200% zoom, safe-area insets, orientation change, and on-screen keyboard keep actions available.

## Design self-grill

| Failure challenged | Severity | Spec response |
| --- | --- | --- |
| Bottom navigation covers the last card or pagination | High | Reserve page-bottom space for bar plus safe area; test at phone widths. |
| Bottom navigation clearance breaks between 640 and 767 px | High | Keep phone-nav clearance until the nav hides at 768 px; include safe-area inset in page padding. |
| The location field appears twice or changes behavior at a breakpoint | High | Keep it in the sheet below 1024 px and inline at desktop width only. |
| A dismissed filter sheet silently commits or loses applied settings | High | Separate applied and draft values; Apply commits, all other dismissals discard. |
| Invalid date boundaries return a confusing empty state | Medium | Validate the range inline and disable Apply until corrected. |
| An older network response overwrites a newer query or page | High | Abort older requests and ignore any response whose sequence is no longer current. |
| Saved search/filter behavior or ordering is ambiguous | High | Define exact local fields, empty-metadata behavior, inclusive date bounds, page size, and order. |
| An empty publication date leaks through Explore's posted-before filter but not Saved | High | Exclude null/empty publication dates from either Explore date-bound query when a date filter is active. |
| Existing saved roles appear absent when a Saved filter has no matches | Medium | Separate truly empty Saved from filtered-empty Saved and provide a clear-search-and-filters action. |
| Description search returns different roles in Explore and Saved | Medium | Use the same first-eight-term, all-whole-token rule for both destinations. |
| A date range has unclear count or chip removal semantics | Medium | Count each active date bound as a separate filter with its own removable chip. |
| Native date controls are clipped or hard to distinguish at narrow/sidebar widths | Medium | Label After and Before; stack below 360 px and in the desktop sidebar. |
| Corrupt or blocked local storage is shown as “zero saved” or overwritten | High | Show count unavailable, disable Save with recovery guidance, never silently replace data. |
| A storage retry clears an unresolved quota/write failure | High | Verify write access with the same validated snapshot before re-enabling Save. |
| User is stuck with unreadable local data or wants to clear a shared profile | High | Retry or confirm removal of only the bookmark storage key; never auto-clear. |
| Removing a final-page bookmark leaves the user on a blank page or loses focus | High | Clamp the page count, move focus to a stable target, and announce the change. |
| A small provider badge relies only on color or becomes unreadable in dark mode | Medium | Keep provider name as text and validate contrast in both themes. |
| A modal action is hidden behind the phone keyboard or safe-area inset | High | Pin the footer above the keyboard and safe area; test dynamic viewport and orientation. |
| A role card's nested controls trigger an unintended card navigation | High | Keep the card non-clickable; use explicit Apply/View and Save controls. |
| Reduced-motion users lose context or receive a motion-dependent state cue | Medium | Keep state text/semantics and remove sheet movement and shimmer. |
| Selector triggers fall below the documented touch target | Medium | Give phone/tablet combobox triggers their own 44 × 44 px hit areas. |

## Non-goals and open risks

- No native-app behavior, account, cloud sync, offline API search, infinite scroll, or swipe-only actions.
- The first implementation of phone navigation, tablet navigation, and the draft/apply filter sheet is on `ui/mobile`; council review and responsive device-matrix validation remain open.
- A local Saved count exposes only the number of roles stored in the current browser; the badge must not be framed as an account total.
- Storage denial, malformed data, and quota exhaustion keep Save unavailable, preserve data, and expose Retry plus confirmed clear recovery.
- No usability study or cross-device matrix has validated this proposal; targeted browser QA covers 390, 640, 767, and 820 px, Saved's filtered-empty recovery, selector hit areas, and reduced-motion suppression.

## Independent proposal synthesis

| Perspective | Score | Adopted contribution |
| --- | ---: | --- |
| GitHub Copilot — task-flow | 8/10 | Keep search → scan → save/open direct; preserve list state on failure; make local-storage failures explicit. |
| OpenCode Crouton Alpha — thumb-first | 7.5/10 | Prioritize safe-area-aware bottom navigation, ≥44 px controls, and a reversible filter sheet. |
| OpenCode DeepSeek V4.1 Flash Free — accessible resilience | 8/10 | Require request ordering, typed failure states, focus behavior, and assistive-technology checks. |

The council rejected adding a job-detail route, location/geolocation autocomplete, a two-column tablet card grid, or swipe-only actions: they exceed the current product/API scope and dilute the one-column discovery flow.

## Source documents

- [Design brief](./design-brief.md): product intent, rejected defaults, composition, and responsive direction.
- [Interaction specification](./interaction-spec.md): per-control behavior, state transitions, and acceptance scenarios.

## Review history

The spec is final only when each named reviewer independently scores the same revision at least 9/10. Any lower score triggers a focused edit and a new review round with all three reviewers; do not average scores or waive an unresolved high-severity issue.

| Review round | GitHub Copilot | OpenCode Crouton Alpha | OpenCode DeepSeek V4.1 Flash Free | Changes |
| --- | --- | --- | --- | --- |
| Round 1 | 6/10 | 6.5/10 | not requested | Added request sequencing; complete Saved filtering/page semantics; exact filter counts/chips; local-data recovery; one focus target; and testable acceptance cases for all findings. |
| Round 2 | no score | 8/10 | not requested | Fixed responsive clearance, filtered-empty Saved recovery, reduced motion, filter-count naming, card type sizes, selector targets, Saved empty-date handling, and immediate Enter submit. |
| Round 3 | 8/10 | 8/10 | not requested | Added the Explore SQL empty-date guard; clarified the zero-count badge contract and removed reduced-motion combobox popup animation. |
| Round 4 | 8.5/10 | 9/10 | not requested | Aligned page gutters and card padding with the documented spacing, suppressed combobox popup animation under reduced motion, and clarified the zero-draft-count footer contract. |
| Round 5 | 9.1/10 | 9.2/10 | unavailable | Hardened bookmark identity/value validation; DeepSeek V4.1 Flash Free was unavailable for this round. |
| Round 6 | 9/10 | 9/10 | 8/10 | Added strict duplicate/empty-string storage handling, unavailable Saved summary, and dialog labelling. Round 6 follow-up fixes address touch-target sizing, toast overlap, tablet readability, long-text wrapping, and focus contrast. |
| Round 7 | in progress | in progress | in progress | Verified the Round 6 follow-up fixes and corrected review metadata before final council scoring. |
