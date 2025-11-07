# TREAZRISLAND App Router Audit & Low-Fidelity Wireframes

This document inventories the current App Router surfaces, aligns them with the minimum UI frames defined for TREAZRISLAND, and captures low-fidelity wireframes that respect Nielsen Norman usability heuristics while preserving the SNES-inspired Monkey Island aesthetic.

## Route audit summary
| Route | Minimal frame coverage | Key implementation files | Notes |
| --- | --- | --- | --- |
| `/` | Shell, stats overview | `frontend/app/page.tsx`, `frontend/src/components/dashboard-panels.tsx` | Landing surface includes quick links and dashboard panels for stats and recent play states. |
| `/platforms` | Library hub | `frontend/app/platforms/page.tsx`, `frontend/src/library/platform-library-page.tsx` | Entry point into the library by platform. |
| `/platforms/[slug]` | Library detail, favorites | `frontend/app/platforms/[slug]/page.tsx`, `frontend/src/library/platform-detail-page.tsx` | Provides filtering, favorites toggle, and ROM grid for a platform. |
| `/roms/[id]` | Library detail modal | `frontend/app/roms/[id]/page.tsx`, `frontend/src/library/rom-detail-sheet.tsx` | Focused ROM detail surface, reachable from library cards. |
| `/collections`, `/collections/[slug]` | Library curation | `frontend/app/collections/page.tsx`, `frontend/src/library/collections-page.tsx`, `frontend/app/collections/[slug]/page.tsx` | Curated groupings of ROMs and individual collection detail view. |
| `/top-lists`, `/top-lists/[slug]` | Library discovery, stats | `frontend/app/top-lists/page.tsx`, `frontend/src/library/top-lists-page.tsx` | Highlights popular or crew-curated leaderboards. |
| `/play`, `/play/[romId]` | Player surface | `frontend/app/play/page.tsx`, `frontend/app/play/[romId]/page.tsx`, `frontend/app/play/[romId]/EmulatorPlayer.tsx` | Launches emulator with lookup support and ROM metadata header. |
| `(auth)/login`, `(auth)/signup` | Auth flow | `frontend/app/(auth)/login/page.tsx`, `frontend/app/(auth)/signup/page.tsx` | Pixel-framed login and invitation-gated signup experiences. |
| `(onboarding)/page` | Onboarding | `frontend/app/(onboarding)/page.tsx`, `frontend/src/onboarding/onboarding-entry.tsx` | Suspense-wrapped onboarding entry point for first-run tasks. |
| `/settings` | Settings | `frontend/app/settings/page.tsx`, `frontend/app/settings/SettingsPageClient.tsx` | Captain’s quarters for user profile management. |
| `/admin/uploads`, `/admin/creative-assets`, `/admin/invitations` | Admin (uploads, enrichment, access) | `frontend/app/admin/uploads/page.tsx`, `frontend/app/admin/creative-assets/page.tsx`, `frontend/app/admin/invitations/page.tsx` | Admin-only workflows for ROM uploads, art enrichment, and invitations. |

### Shared layout and theming
The root layout provides the shared AuthProvider wrapper, SNES color tokens, and constrained page width, giving each frame a consistent shell with Monkey Island theming while keeping the focus on content panels. 【F:frontend/app/layout.tsx†L1-L26】

## Low-fidelity wireframes by frame
Wireframes below use ASCII blocks to communicate hierarchy, spacing, and key components. Each highlights the primary heuristics satisfied (H1–H10 referencing Nielsen Norman’s heuristics).

### 1. Shell / Dashboard (`/`)
```
+---------------------------------------------------------------------------------+
| PIXEL HEADER: "Welcome to TREAZRISLAND" (H2)                                    |
| Quick-start description & CTA buttons (H3, H6)                                  |
+---------------------------------------------------------------------------------+
| DASHBOARD GRID (2 columns)                                                      |
| [Server overview metrics tile] (H1, H4, H9)    [Recent save states list] (H5, H7)|
|  - Users / ROM catalog counts                                                   |
|  - Storage usage breakdown                                                      |
| CTA: Explore Library                                                            |
+---------------------------------------------------------------------------------+
```
- **Heuristics:** H1 status visibility via live stats, H2 match to Monkey Island narrative, H3 control through clear CTAs, H4 consistent pixel frame styling, H7 efficiency via quick access to recent play states, H8 minimal layout, H9 recovery messaging for data load errors.
- **Shared components:** `PixelFrame`, `DashboardPanels`.

### 2. Onboarding (`/onboarding`)
```
+--------------------------------------------------------------+
| PIXEL FRAME: Onboarding progress header (H1, H2)              |
| Step indicator / breadcrumb                                  |
+--------------------------------------------------------------+
| Content slot (varies by step) (H6)                            |
|  - Profile setup form / metadata sync prompts                |
|  - Illustrative pixel art vignette                           |
+--------------------------------------------------------------+
| Footer: "Skip for now" + "Continue" actions (H3, H5)         |
+--------------------------------------------------------------+
```
- **Heuristics:** H1 showing progress, H3 providing skip/continue, H5 preventing errors with inline validation, H6 recognition with summarized steps, H10 linking to docs for network setup.
- **Reuse:** Onboarding steps can reuse `PixelFrame` and shared CTA buttons.

### 3. Auth (Login & Signup)
```
+--------------------------------------------+
| PIXEL FRAME (centered)                     |
|  Title: "Welcome Back / Welcome Aboard"    |
|  Description referencing invitations       |
|  Form fields stacked with labels           |
|  Primary CTA: "Sign in" / "Create account" |
|  Secondary: "Need help?" link              |
+--------------------------------------------+
```
- **Heuristics:** H2 uses nautical copy, H3 includes cancel/back link, H5 invites validation on token/email, H7 supports password managers (field labels), H9 error messaging for invalid invites.
- **Notes:** Maintain parity between login and signup frames; highlight invitation token preview in signup.

### 4. Library Hub (`/platforms`)
```
+------------------------------------------------------------------------+
| PIXEL FRAME HEADER: Platform library title + search/filter summary      |
+------------------------------------------------------------------------+
| Filter toolbar (search, sort, platform badges) (H7)                     |
+------------------------------------------------------------------------+
| Virtualized grid of platform cards (3-up) (H1 via loading states)       |
|  Card: pixel art thumbnail, ROM count, CTA to platform detail (H6)      |
+------------------------------------------------------------------------+
```
- **Heuristics:** H1 loading skeletons, H3 clear navigation into detail, H6 recognition via thumbnails, H8 minimal repeated elements.
- **Reuse:** `VirtualizedGrid`, `PixelFrame`, filter controls shared with platform detail.

#### 4a. Platform Detail & Favorites (`/platforms/[slug]`)
```
+----------------------------------------------------------------------------------+
| HEADER PIXEL FRAME: Platform name, ROM count, active filters summary (H1, H2)     |
| Filter controls row + "Favorites only" toggle (H3, H7)                            |
+----------------------------------------------------------------------------------+
| Status banners (loading/error) (H9)                                              |
+----------------------------------------------------------------------------------+
| Virtualized ROM grid                                                             |
|  Card: title, synopsis snippet, metadata, favorite star button (H4, H5, H6)      |
|  Footer: players indicator + "View details" link                                |
+----------------------------------------------------------------------------------+
| Pagination / Load more CTA (H3)                                                  |
+----------------------------------------------------------------------------------+
```
- **Heuristics:** H1 status banners, H3 toggles and pagination, H5 preventing errors via disabled states when favorites API pending, H6 recognition by surfaces summary text, H7 efficiency via favorites filter, H9 error banners.
- **Favorites frame:** The toggle and card actions serve as the dedicated favorites UI. For a standalone `/favorites` quick-filter, reuse this grid with default "Favorites only" on and saved search states.

#### 4b. Collections (`/collections`) & Top Lists (`/top-lists`)
```
+---------------------------------------------------------------+
| HERO PANEL: Collection/Top List intro copy (H2)               |
| Tabs or segmented controls (All / Mine / Featured) (H7)       |
+---------------------------------------------------------------+
| Card list                                                     |
|  - Cover art, brief description, ROM count                    |
|  - CTA: "View collection" / "View list" (H3)                 |
+---------------------------------------------------------------+
```
- **Heuristics:** H1 statuses for loading, H3 navigation CTAs, H4 consistent card patterns, H6 recognition by descriptive art, H8 curated minimal layout.

#### 4c. ROM Detail (`/roms/[id]`)
```
+---------------------------------------------+
| Modal-style pixel frame (H3 close button)   |
|  Hero art / metadata summary (H6)           |
|  Tabs: Overview / Screenshots / Notes       |
|  CTA bar: Play now, Favorite toggle         |
+---------------------------------------------+
```
- **Heuristics:** H1 status for metadata load, H3 close/back controls, H5 disable play when ROM missing assets, H7 quick actions.

### 5. Player (`/play` & `/play/[romId]`)
```
+------------------------------------------------------------------------------------+
| HEADER PIXEL FRAME: ROM title, platform, ROM ID (H1, H2)                            |
| Inline ROM lookup form (Load by ID) (H3, H5)                                       |
+------------------------------------------------------------------------------------+
| MAIN PLAYER PANEL                                                                  |
|  Emulator viewport (16:9) with frame + toolbar (Pause, Save State, Fullscreen)      |
|  Sidebar (collapsible) with:                                                        |
|   - Play state slots list (H1)                                                     |
|   - Quick actions: Load last save, Upload state                                    |
| Footer: Troubleshooting link (H10)                                                 |
+------------------------------------------------------------------------------------+
```
- **Heuristics:** H1 real-time status (save confirmations), H3 control over playback, H5 prevent errors with confirmation dialogs, H7 keyboard shortcuts, H9 fallback messaging when ROM missing, H10 link to emulator docs.

### 6. Favorites (dedicated lens)
```
+------------------------------------------------------------------+
| PIXEL FRAME HEADER: "Starred Adventures"                         |
| Filter chips: Platform, Genre, Recently played (H7)              |
+------------------------------------------------------------------+
| Empty state banner when no favorites (H9)                        |
+------------------------------------------------------------------+
| Grid of favorite ROM cards (reuse Platform detail card) (H4)     |
|  - Inline play + remove favorite actions (H3, H5)                |
+------------------------------------------------------------------+
```
- **Heuristics:** H1 indicates sync status, H3 inline actions, H5 confirmation for removal, H6 recognition via card art, H8 consistent minimal layout.
- **Implementation note:** This view can route to `/favorites` (new page) or be a saved filter within `/platforms/[slug]`; both reuse `useFavorites` state.

### 7. Admin surfaces
#### 7a. ROM & BIOS Uploads (`/admin/uploads`)
```
+--------------------------------------------------------------------------+
| PIXEL FRAME HEADER: "ROM & BIOS Dropzone" with process summary (H2)       |
| Alert banner for ingest queue status (H1, H9)                             |
+--------------------------------------------------------------------------+
| Upload widget: drag-and-drop zone, file list with progress bars (H1, H5)  |
|  - Columns: File name, size, status, actions (cancel/retry)              |
|  - Metadata enrichment toggle per upload                                 |
+--------------------------------------------------------------------------+
```
- **Heuristics:** H1 progress indicators, H3 cancel upload, H5 validation on file types, H7 bulk actions, H9 error badges.

#### 7b. Creative Assets (`/admin/creative-assets`)
```
+--------------------------------------------------------------------------+
| HERO PANEL: Curated Artwork description (H2)                             |
+--------------------------------------------------------------------------+
| Asset gallery grid                                                       |
|  - Thumbnail, assigned ROM/platform, rotation schedule (H6)              |
|  - Actions: Upload new, Set as default, Remove (H3, H5)                  |
| Right rail: Guidelines + download template (H10)                         |
+--------------------------------------------------------------------------+
```
- **Heuristics:** H1 status badges for publishing, H4 consistent card layout, H6 recognition by thumbnails, H7 multi-select for batch updates, H10 inline documentation.

#### 7c. Invitations (`/admin/invitations`)
```
+------------------------------------------------------------------+
| Header frame: "Invitation Forge" copy (H2)                        |
| Form: email, role select, expiration (H5)                         |
+------------------------------------------------------------------+
| Table of invitations                                              |
|  Columns: Email, Role, Created, Status, Actions (copy/revoke)     |
| Inline alerts for API failures (H9)                               |
+------------------------------------------------------------------+
```
- **Heuristics:** H1 immediate confirmation, H3 revoke tokens, H5 validation on email/roles, H7 clipboard copy, H9 inline errors.

### 8. Settings (`/settings`)
```
+---------------------------------------------------------------------+
| Header frame: "Captain's quarters" intro (H2)                        |
+---------------------------------------------------------------------+
| Two-column layout (stacked on mobile)                               |
|  Left: Profile details (avatar upload, display name, bio) (H3, H5)   |
|  Right: Account security (password reset link, API tokens) (H5, H7)  |
| Notification toggles + save CTA                                      |
| Footer: Danger zone (delete account) with confirmation (H9)          |
+---------------------------------------------------------------------+
```
- **Heuristics:** H1 success/error banners, H3 explicit save/cancel, H5 inline validation, H7 quick actions, H8 minimalist grouping, H9 destructive actions separated, H10 link to support doc.

## Backend capability coverage
| Backend capability | UI surface(s) covering it |
| --- | --- |
| Authentication (login, signup, session refresh) | Auth frames (`/login`, `/signup`) and global `AuthProvider` shell. |
| Onboarding workflow | `/onboarding` Suspense entry point with stepper content. |
| Library browsing (platforms, collections, top lists, ROM detail) | `/platforms`, `/platforms/[slug]`, `/collections`, `/top-lists`, `/roms/[id]` wireframes. |
| Emulator play states (launch, resume, save history) | `/play`, `/play/[romId]` header + player, dashboard recent saves panel. |
| Favorites management (list, toggle) | Platform detail cards, favorites filter, dedicated favorites lens proposed here. |
| Admin uploads and enrichment | `/admin/uploads` upload manager, `/admin/creative-assets` gallery. |
| Admin invitations / access control | `/admin/invitations` form and table. |
| Stats & health reporting | Dashboard panels on `/` summarizing server stats and storage. |

All backend endpoints described in the PRD/API docs have a correlating UI surface in these wireframes, ensuring engineers can trace functionality end-to-end.

## Stakeholder review readiness
- Present the ASCII wireframes in weekly design sync, highlighting how copy and panel names echo Monkey Island motifs while staying legible.
- Gather feedback on:
  - Preferred terminology for favorites ("Starred" vs. "Favorites").
  - Level of whimsy vs. clarity in admin panel copy.
  - Any additional art direction cues needed before high-fidelity mocks.
- Incorporate stakeholder copy tweaks before implementation; track approvals inline within this file or via design tickets.

## Component reuse & implementation notes
- **PixelFrame & pixel primitives:** Anchor every frame, ensuring brand consistency and reducing CSS churn.
- **Filters & grids:** `LibraryFilterControls` and `VirtualizedGrid` serve both platform and favorites experiences, minimizing new component work.
- **Stateful hooks:** `useFavorites`, `useVirtualizedGridResetKey`, and dashboard data hooks underpin multiple frames; ensure they remain client-safe.
- **Status banners:** Reuse the dashboard error banner pattern for admin/upload surfaces to provide consistent feedback.
- **Documentation updates:** As high-fidelity designs evolve, extend this file with linked images (PNG exports) and embed annotations referencing component directories for engineering handoff.
