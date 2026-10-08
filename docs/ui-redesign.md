# UI/UX redesign: starting brief

**Status:** started. This brief records what the audit found and proposes an order. It makes no visual change yet. The decisions at the top come first, because the design work depends on them.

## Decisions needed

1. **Visual direction.** Refine the current look (same palette and components, fewer overlaps, clearer hierarchy), or move to a new visual system (palette, type and components designed to work for every department).
2. **Department colour.** One accent per department, taken from its logo, or one platform colour with the department shown only as its name and logo.
3. **First pass scope.** Entry screens and the shell first (sign-in, sign-up, onboarding, approval, navbar, sidebar and drawer, footer), or the student dashboard as well.
4. **Order.** Web first, then mobile, or both together on shared components.

## What the audit found

Observed in the scratch build against the live API, on the approval page, the drawer and the dashboard shell:

- **Overlays cover content on small screens.** The cookie notice sits over the drawer and the lower part of the card at 390 px.
- **The footer overlaps the page.** On the approval page at 1280 × 900, the footer bar covers the card's lower button. At 390 px it covers the "Under Review" badge.
- **Sidebar groups start collapsed.** Community and Finance open closed, so their items are hidden until a student opens them.
- **Colour competes.** The amber used for "waiting" sits beside the primary blue. On the approval card the department badge is blue on pale amber.
- **Mobile status screens wrap badly.** The approval title wraps to two lines at 390 px, and the status icon floats alone on the left edge.
- **Mobile screens were built for one association.** Splash, welcome, sign-in and settings now say "Admin Pack" and the department's name, but their layouts were not designed for several departments and have not been reviewed.

## Principles (proposed)

1. Shared chrome says Admin Pack. Department content uses the department's name, logo and accent.
2. Web and mobile show the same states with the same words: sign-in, approval, dashboard.
3. Status colours are for status only. One accent per department; everything else neutral.
4. Nothing important sits under an overlay or over a sticky footer.

## Order of work (proposed)

1. **Foundations.** Colour, type and spacing tokens; a department accent; shared status, approval and empty-state components. Web and mobile.
2. **Shell.** Navbar, sidebar and drawer, footer, cookie notice.
3. **Entry.** Sign-in, sign-up, onboarding, approval.
4. **Student core.** Dashboard, payments and dues, courses, profile.
5. **Admin and lecturer screens.**

Each step is checked with screenshots at 1280 and 390 px before the next one starts.
