# UI/UX redesign: starting brief

**Status:** the layouts are being rebuilt from the fresh brief below (October 2026). The approved template from the earlier review was lost in a sandbox reset, so the rebuild follows this brief, not that template. The audit and decisions further down still apply.

## Fresh brief (rebuild)

Scope of this pass: the web app's entry screens (sign-in, sign-up, approval) and the shell (navbar, sidebar, footer). Mobile follows once the web pass is reviewed.

**Layout rules**

1. **Entry screens.** Two columns from 768 px. The left column is the department: its logo (large), name, institution and description. "Admin Pack" is the small platform line under it, never the heading when a department is chosen. The right column is one card with the form. Below 768 px the department brand sits inside the card and the left column is hidden.
2. **Approval screen.** One card, no decorative bar. Top: the department's brand row (logo, name, institution). Then the title "Waiting for approval", one sentence on who is reviewing, the student's details, and the actions. The page never scrolls past its actions on a 390 px screen without the actions being reachable.
3. **Navbar.** Always shows the department logo and name, from 360 px up. The description appears only from 1280 px, and truncates. The search box is hidden below 640 px. No "Admin Pack" in the navbar.
4. **Sidebar.** Groups start open, so nothing is hidden by default. A group can be closed by hand. Items keep their icons and labels.
5. **Footer.** In the page flow, never fixed or sticky, so it cannot cover a button. It shows the department's name and institution, with "Powered by Admin Pack" as the platform line.
6. **Cookie notice.** A strip in the page flow above the footer (already in place).

**Colour**

- One accent per department, taken from its logo, used for primary actions, links and the active navigation item.
- Status colour is used only for a status pill (waiting, approved, rejected). A status colour never tints a whole card, a logo tile or a heading.
- Everything else is neutral surface and text.

**Words**

- The same words on web and mobile for the same state: "Waiting for approval", "Under review", "Approved", "Rejected".

**Checks before a screen is accepted**

- Screenshot at 1280 and 390 px, signed out and signed in.
- No text or button under an overlay or a sticky footer.
- Status colour appears only in the status pill.
- Tests for the words and links the screen must show.

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
- **Mobile screens were built for one association.** Splash, sign-in and settings now say "Admin Pack" and the department's name, but their layouts were not designed for several departments and have not been reviewed.

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

## Decisions (approved)

- The template in the design preview (kept outside the repo) is the basis for the web app's sign-in, sign-up, approval and shell screens. Mobile follows later.
- The accent comes from each department's logo. It is computed when the logo is set (`cmd/tenant update -logo` and `cmd/tenant logos`) and stored with the department as `accent_color`, so the API gives every client the same value. The web app uses it as its primary colour (see the Accent colour rule in `docs/multi-tenancy.md`). The Computer Engineering logo gives `#1b65a7`, with white text at 6.1:1. The preview's sample accent, `#1a5ca2`, differs slightly from it, and the computed value is the one that ships.
- Status: the tokens and the accent are built for the web app. The template's layouts for the sign-in, sign-up, approval and shell screens are not applied yet. The mobile app does not use the accent yet.
- Admin Pack appears only in the platform line on the entry screens and in the footer. The department's name, logo and description carry the rest of each screen.
- Order: tokens and accent first, then sign-in, approval and sign-up, then the shell (top bar, sidebar, footer).
