# Classic-Car-Restoration-Shop-Portfolio-ProdeskIT
A shop-floor board for a classic car restoration business — vanilla HTML/CSS/JS, no frameworks. Handles spotty connections, invalid input, and full a11y out of the box.

## Features

**Board**
- Live "instrument panel" dashboard — analog SVG gauges (not a chart library) summarizing fleet status at a glance
- Searchable, filterable restoration board with per-status color coding
- Intake form to log a new vehicle onto the board

**Edge cases**
- Empty states: distinct "no data yet" vs. "no results for this search" messaging — never a blank screen
- Simulated network: random delay + ~15–20% simulated failure rate to model a spotty 3G connection, with a loading skeleton, an explicit error state, and a retry action
- Form validation: required fields, malformed input rejected, invalid fields highlighted in red with inline messages, focus moves to the first error

**Non-functional requirements**
- Accessibility: semantic landmarks, skip link, labeled form controls, `aria-live` regions for search results/form status/toasts, visible focus rings, full keyboard operability, `prefers-reduced-motion` respected
- Telemetry: `console.log("[Analytics] User interacted with Classic Car Restoration Shop Portfolio", …)` fires on every primary action (search, filter, add, remove, retry)
- Security: all free-text input is HTML-escaped via `sanitizeText()` before it touches state or the DOM, preventing stored/reflected XSS
- Design system: one grayscale scale plus a single copper accent, expressed as CSS custom properties — no ad hoc hex values in component rules

