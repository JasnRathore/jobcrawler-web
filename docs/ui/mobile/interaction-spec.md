# Mobile interaction specification

**Status:** Draft; Round 7 review in progress

**Companion:** [Mobile UI design brief](./design-brief.md)

**Authority:** This companion and the [final mobile UI spec](./final-mobile-ui-spec.md) are both proposals until the council gate is met.

## Interaction principles

- Use native buttons, links, inputs, and disclosures wherever they fit. Stateful sheets and comboboxes retain their accessible primitive behavior.
- Every action is available without a swipe, hover, or precision gesture.
- Interactive hit areas are at least 44 × 44 CSS px, including bookmark, close, clear, pagination, and navigation controls.
- Search results and status changes are announced without moving focus unexpectedly; explicit destination, page, and Apply actions focus the result summary.
- Search and filter state stays visible in the UI; opening or closing a sheet does not silently discard applied criteria.

## Destination navigation

### Phone

- A fixed bottom bar contains **Explore** and **Saved** destinations, with selected state conveyed by text and semantics as well as color.
- The bar accounts for `env(safe-area-inset-bottom)`. Its hit area stays above the device home indicator.
- The scrollable page reserves bottom padding equal to the bar height plus the safe-area inset, so the final card and pagination can be reached without being covered.
- Saved shows a visual count badge only when the count is greater than zero, capped visually at `99+`. Its accessible name includes the exact count or states that it is unavailable/loading.
- Selecting a destination updates the current-page state, resets that destination's page to 1, retains search and applied filters, scrolls the list to the top, focuses the result summary, and announces the destination and current result count.
- The open filter sheet covers destination controls. Dismiss it to discard the draft before selecting another destination; resizing to desktop closes the sheet and discards its draft.
- Do not move focus automatically on initial page load; retain the browser's current focus.

### Tablet and desktop

- At 768–1023 px, use a compact Explore/Saved segmented destination control near the results heading.
- At 1024 px and wider, preserve the current sidebar destination controls.
- In every mode, destinations are a `<nav>` containing buttons; the active button uses `aria-current="page"`. They are not ARIA tabs and do not reset search or applied-filter state.

## Theme

- The theme button stays reachable from the compact header on phones and tablet layouts. It is not placed inside the filter sheet.
- One activation switches between light and dark immediately. The icon and accessible name describe the next action (“Switch to dark mode” or “Switch to light mode”).
- Persist the explicit choice in this browser; with no saved choice, follow the operating-system preference. A theme change does not reset search, filters, destination, list position, or open sheet state.
- If preference storage fails, keep the current page usable and the selected theme applied for the session; do not block navigation or job actions.

## Search

### Role and keyword

- The role/keyword field is the primary search control and has a persistent accessible label; placeholder copy is supplemental.
- On phones, focus must not zoom the page. Use a text size of at least 16 px.
- Explore search updates results after a 250 ms debounce; Enter/submit bypasses the debounce. Enter does not reload the document. Saved search filters the local list immediately.
- When description search is enabled, all of the first eight alphanumeric query terms must match whole tokens in the description; title, company, and location use case-insensitive substring matching. Explore and Saved use the same description rule.
- Clear removes only the query, returns to page 1, and refreshes the current destination.
- Keep the entered query visible while loading or after an error. A failed request never silently clears it.

### Location

- Below 1024 px, expose location in the filter sheet so the main search remains usable and there is only one location control.
- At 1024 px and above, location is inline beside role search and applies live. The breakpoint is fixed so the same viewport does not alternate between behaviors.

| Current state | Action | Next state and result |
| --- | --- | --- |
| Idle | Focus and type | Keep text in the field; debounce the Explore request or update the Saved list locally |
| Query/location changed | Debounce completes or user submits | Loading; retain query, applied filters, scroll position, and prior results |
| Loading | Request succeeds | Results or the appropriate empty state; announce the new count politely |
| Loading | Request fails | Error with retry; preserve input, applied filters, and last successful results |
| Any search state | Clear query | Empty query, page 1, refresh current destination; do not clear location or other filters |

Only the latest Explore request may update results, count, error, or page state. Abort the previous request when query, filter, page, or destination changes, and ignore any response whose request sequence is no longer current.

## Filter sheet

### Opening and closing

- The Filters control has a 44 × 44 px minimum target. Show the count badge only when at least one filter is active.
- Its accessible name includes the applied-filter count, including zero (for example, “Filters, 0 active”). Opening it announces the title “Filters.”
- The sheet opens as a bottom sheet on phones and a right-aligned, 26 rem side sheet on 768–1023 px. It is modal, traps focus, and returns focus to the trigger on close.
- Escape, the close control, and backdrop dismissal close the sheet. All three discard unapplied edits; only **Apply filters** commits them.
- Native date controls and provider/employment/workplace choices, including their selector triggers, remain operable with touch, keyboard, and assistive technology; phone/tablet triggers meet the 44 × 44 px target and opening a selector must not close the parent sheet.
- Lock background scrolling while the sheet is open. The sheet has its own scroll region and a pinned footer that remains visible above the software keyboard and safe area.

### Fields and state

Below 1024 px, the filter sheet exposes:

1. Location
2. Platform/provider
3. Employment type
4. Workplace type
5. Posted after and posted before
6. Search within job description toggle
7. Reset filters

At 1024 px and above, location remains in the inline search row and the sidebar contains the remaining filters.

Date controls are visibly labeled **After** and **Before**. Stack them below 360 px and in the desktop sidebar; display them side by side from 360 px in the mobile/tablet sheet.

Provider, employment, and workplace are single-select controls. Their choices are:

| Filter | Values |
| --- | --- |
| Provider | All, Ashby, Greenhouse, Lever, Lever EU, Workable |
| Employment | Any, Full-time, Part-time, Contract, Internship |
| Workplace | Any, Remote, Hybrid, On-site |

Dates use the ISO calendar date of `first_published`; both boundaries are inclusive. Explore applies the same boundaries in UTC calendar-date terms. On Saved, the date is the first 10 characters of the stored ISO timestamp. Empty metadata never matches an active field filter.

Opening the sheet copies applied values into a draft. Changing a field changes only the draft; result count, active-filter chips, and results do not change until Apply. **Apply filters** commits the complete draft atomically, resets to page 1, closes the sheet, and focuses the result summary. The footer action shows the number of draft filters when the count is greater than zero; do not imply an estimated result count when the API does not provide one.

On desktop, preserve the current live-apply behavior for inline filters. The distinction is intentional: a phone/tablet sheet has explicit Apply and Cancel because it is a temporary modal surface; inline desktop controls remain directly visible. Applied values and results must remain the same when crossing breakpoints.

**Reset** clears all fields in the draft but leaves the sheet open. The user must Apply to commit the reset. **Cancel**/close discards the draft. A date range with an after-date later than the before-date is marked inline; Apply remains disabled until corrected or reset.

| Current state | Action | Next state and result |
| --- | --- | --- |
| Closed | Activate Filters | Open; copy applied values into draft; move focus into sheet |
| Open, unchanged | Edit a field | Open, dirty; update draft only |
| Open, dirty | Apply valid values | Closed; commit all fields, reset page, refresh results, focus result summary |
| Open, dirty | Apply invalid date range | Open, invalid; announce and associate the date error, keep Apply disabled |
| Open, dirty | Reset | Open, reset draft; applied results remain unchanged |
| Open, dirty/reset | Cancel, Escape, close, or backdrop | Closed; discard draft and restore focus to Filters |

If a viewport change switches from a modal sheet to the desktop inline-filter layout while the sheet is open, close it and discard its unapplied draft. Applied filters remain unchanged.

### Applied-filter chips

- Show applied filters after the result summary when space allows. Each chip has an accessible remove button named for its filter.
- Removing a chip updates that one applied value, returns to page 1, and refreshes results. Do not remove adjacent chips through a broad click target.
- At narrow widths, all chips wrap; overflow is not hidden behind horizontal scrolling or collapsed. Query chips are removable but do not count as filters.
- Count each non-empty filter field once: location, provider, employment, workplace, posted-after, posted-before, and description search. A date range with both bounds counts as two. Each field has one removable chip, so removing one date bound preserves the other.

## Job cards

- The whole card is not an implicit link. Only the explicit Apply/View link opens the original job URL in a new tab; it includes `rel="noopener noreferrer"`.
- Provider identity is visible text, not color alone. Long titles, company names, and locations wrap without clipping actions.
- The primary Save control is a 44 × 44 px button with a programmatic label (“Save role: [title]” or “Remove saved role: [title]”) and `aria-pressed`.
- Label the external action **Apply** when an apply URL exists and **View** when only a details URL exists. If neither URL exists, omit the link and leave Save available.
- Saving writes the job snapshot to this browser's local storage and updates the card and Saved count immediately. Removing it also updates the Saved list immediately.
- Announce success in a polite live region (“Saved [role] to this device” / “Removed [role] from Saved”). Do not imply account-wide or cross-device persistence.
- When a card is removed from Saved, move focus to the result summary after the list updates; announce the removal and new count. If the list is empty, the summary and empty-state Explore action remain available.
- If storage is unavailable or malformed, keep browsing and applying available. Disable Save with a nearby explanation and offer Retry and a confirmed **Clear saved roles** recovery action; never clear or overwrite unparseable saved data automatically.
- Retrying rereads storage. After a storage error, write back only the same validated snapshot to verify access before restoring Save; if parsing or access still fails, keep Save disabled and retain the user's data.
- If saved data cannot be read, do not display a misleading zero Saved count. Mark the count unavailable and explain that local saved roles could not be loaded.
- The Saved destination's accessible name always includes the exact count or states that it is unavailable/loading. The visual badge is hidden at zero and displays `99+` above 99.
- A **Clear saved** action is available when roles exist. It requires confirmation and removes all local saved roles from this browser profile; it does not affect job-search data.
- Valid v1 snapshots are stored under `jobcrawler.bookmarks.v1`; incomplete or malformed snapshots are treated as unreadable, never partially accepted or overwritten. Saved data stays in this browser profile until individually removed or explicitly cleared; it is not confidential or synced.
- Job brief disclosure is native/keyboard-operable, with an explicit expanded state. It does not open when the user presses the Save or Apply/View control.
- The job-brief summary has a 44 px minimum interaction height on touch layouts.
- Optional metadata may wrap to multiple lines; never truncate the title or apply link to preserve a one-line card.

| Current state | Action | Next state and result |
| --- | --- | --- |
| Unsaved | Activate Save | Write job snapshot; on success change to Saved and update local list/count |
| Saved | Activate Remove | Delete only this job key; on success remove/update immediately |
| Saving/removing | Repeat activation | Ignore while the operation is busy to avoid duplicate writes |
| Any bookmark state | Storage access/parse/quota error | Do not show success; retain current state, explain Save is unavailable, and expose retry |
| Any bookmark state | Same-origin other tab changes storage | Reload and validate stored list; update Saved count and visible list |

### Saved filtering and ordering

- Saved applies the current query and every applied filter locally to validated snapshots; it does not issue a jobs API request.
- The query is a case-insensitive substring in title, company name, or location. When “Search within job description” is on, all of the first eight alphanumeric query terms must match whole tokens in the description, as in Explore. Company slug, department, education, and experience are not searched.
- The separate location filter is a case-insensitive substring of `location_name`. Provider is an exact single-value match; employment and workplace are case-insensitive substrings. Empty metadata never matches an active field filter.
- Posted-after and posted-before compare the first 10 characters of `first_published` with inclusive ISO dates. Saved roles with an empty publication date do not match an active date bound.
- Sort newest publication date first, then title case-insensitively ascending. Explore uses the same ordering.
- Page size is 20 for both Explore and Saved. Saved pagination is local; after any result-count reduction, clamp the visible page to the last available page (minimum page 1). Explore pagination uses the API-reported page and page count.

## Results, pagination, and status

- Keep the results summary (count, range shown, Filters control) visible near the top while scrolling, without covering the first card.
- Initial loading shows three or four card-shaped skeletons with no fake interactive controls. Mark the result region busy and hide skeleton decoration from assistive technology.
- On refresh, retain the current list until the new response arrives; indicate loading in the result summary. Avoid clearing the page or jumping the scroll position for a routine filter change.
- A request failure keeps search and filter controls usable, preserves the last successful list if present, announces the error, and offers a clearly labeled retry.
- Empty results distinguish: no roles found, no saved roles, no saved roles matching the current search/filters, and no Explore results for the current applied filters. When the current search/filters exclude roles, offer a **Clear search & filters** action.
- Truly empty Saved offers a direct Explore destination action and explains that Saved roles live in this browser profile only; they are not synced or confidential. A filtered-empty Saved state explains that roles still exist and offers **Clear search & filters**.
- Use explicit **Previous** and **Next** controls instead of infinite scroll. On phones, they share the row and have minimum 44 px hit areas. Disable the unavailable direction. Announce “Page X of Y” after navigation and focus the result summary, not the document top.
- If removing the last card on a page reduces the page count, clamp to the new last page before rendering the result summary.
- A saved role whose external application URL is unavailable remains visible in Saved; show the unavailable status when known, and do not invent a replacement URL.
- On a failed Explore page request, keep the last successful page visible and offer Retry; only the newest request may replace the list. Abort/supersede older requests on query, filter, page, or destination changes.

## Accessibility and device behavior

- All interactive controls have visible focus, logical DOM/tab order, and clear disabled states. Focus indicators use the existing semantic ring token in both themes.
- A screen reader can identify the page heading, current destination, search form, Filters control, result count, result list, each card's title and metadata, saved state, Apply/View destination, pagination, and sheet controls.
- Announce result count changes with a polite status region; reserve assertive announcements for blocking errors.
- Dialog opening moves focus to the title or first control; closing returns focus to the opener. Focus stays within the modal while open.
- The bottom destination bar remains fixed when the search keyboard opens; after dismissing the keyboard it stays reachable without changing the focused query. The filter-sheet footer remains above the keyboard. Do not rely on fixed pixel viewport height; account for dynamic viewport height.
- When another tab in the same browser changes local bookmarks, update the Saved list and count from the storage event. This does not imply server or cross-device sync.
- Honor safe-area insets at the top and bottom, orientation changes, 200% zoom, and platform text-size preferences.
- No critical action depends on color, animation, hover, or a drag gesture. Reduced-motion mode removes sheet and combobox movement, skeleton shimmer, and loading-spinner rotation.

## Acceptance scenarios

1. At 320 px wide, search, Filters, Saved, Save, and Apply/View are usable without horizontal page scroll or overlapping targets.
2. A user edits three filters, closes with Escape, and sees no changes to applied chips or results; reopening shows the original applied values.
3. A user changes date boundaries to an invalid range; the error is identified inline and cannot be submitted until corrected.
4. A user applies filters and sees page 1 with the new applied-filter count and updated results.
5. A user saves a role, switches to Saved, sees the same role and count, refreshes the page, and sees it still present in the same browser.
6. A user removes a role in Saved and it disappears immediately; browser storage failure does not show success.
7. A user navigates all controls using keyboard only; sheet focus is trapped/restored and the saved state is announced.
8. A user with reduced motion enabled can open/close sheets and understand state without sheet/combobox movement, shimmer, or spinner rotation.
9. At 479, 480, 640, 767, 768, 820, 1023, and 1024 px, navigation and location controls change at documented breakpoints without a transient broken or crowded layout; at 640–767 px, page-bottom padding keeps pagination clear of the fixed navigation.
10. A network failure preserves the current search and visible results, announces the error, and retry recovers without losing applied filters.
11. Two deliberately reordered Explore responses cannot let the older result replace the newest query/page.
12. Saved filtering checks every field and the missing-metadata rule; page size is 20, sort is newest-first/title-ascending, and a count reduction cannot leave a blank page.
13. The count excludes the query chip; each active filter field has one chip, and the two date bounds count independently.
14. A malformed local snapshot shows “count unavailable,” never zero; Retry preserves it, while confirmed Clear saved removes only the bookmark key.
15. After Apply, destination selection, pagination, or removal from Saved, focus reaches the result summary; initial page load does not steal focus.
16. The exact Saved count is announced even when the visual badge is hidden at zero or capped at `99+`.
17. When Saved contains roles but current search/filters match none, the empty state says so and **Clear search & filters** restores those roles; truly empty Saved offers Explore and does not imply confidentiality.
18. An empty `first_published` value is excluded by posted-after and posted-before filters in both Explore and Saved.
