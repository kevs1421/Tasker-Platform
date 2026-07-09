---
Task ID: 1
Agent: main
Task: Build complete Asana-like TaskFlow app with Admin, Team, and Client dashboards

Work Log:
- Designed comprehensive Prisma schema with 11 models (User, Project, ProjectMember, ClientProject, Task, TaskAssignment, Subtask, Comment, OnboardingForm, Onboarding, Message, ActivityLog)
- Created 15+ API routes for auth, admin, projects, tasks, comments, users, onboarding, messages, subtasks, assignments, profile
- Built login page with registration and quick demo access buttons
- Built AppShell with responsive sidebar, header with notifications, and user dropdown
- Built Admin Dashboard (6 tabs: Overview with charts, Onboarding review, Projects CRUD, Tasks management, Messages, Profile)
- Built Team Dashboard (4 tabs: Projects with kanban, Tasks with board/list views, Messages, Profile)
- Built Client Dashboard (4 tabs: Multi-step Onboarding wizard, Projects tracking, Messages, Profile)
- Seeded database with 6 users, 4 projects, 24 tasks, subtasks, comments, messages, activity logs, onboarding forms and submissions
- All lint errors resolved

Stage Summary:
- Full Asana-like task management app with 3 role-based dashboards
- Admin: analytics, user management, onboarding review, project/task CRUD, messaging
- Team: kanban board, task management, project tracking, messaging
- Client: multi-step onboarding forms, project visibility, task comments, messaging
- Demo accounts: admin/123, sarah@123, john@123
---
Task ID: 2
Agent: main
Task: Remove public registration, add admin-only user registration in dashboard

Work Log:
- Updated src/features/login-page.tsx: Removed Tabs and Register tab, now shows only Sign In form
- Updated src/app/api/auth/register/route.ts: Returns 403 Registration is disabled for all POST requests
- Updated src/app/api/register/route.ts: Now requires adminUserId in request body, verifies admin role
- Added AdminUsers component to src/features/admin-dashboard.tsx with user table, search, filter, role change, activate/deactivate, Add User dialog
- Added Users nav item to admin sidebar in src/features/app-shell.tsx
- Added users tab to admin route type in src/types/index.ts
- Wired AdminUsers component in src/app/page.tsx
- Fixed lint error in TaskDetail.tsx
- Verified via VLM screenshot and curl API tests

Stage Summary:
- Login page: No register tab, only Sign In + demo account buttons
- /api/auth/register: Completely blocked (403)
- /api/register: Admin-only, requires valid adminUserId
- Admin sidebar: New Users tab with full user management
- AdminUsers: search, filter, role change, activate/deactivate, add user dialog
- All APIs verified working correctly

---
Task ID: 3
Agent: main
Task: Add user selection for task assignees in TaskDetail and AdminTasks

Work Log:
- Added assignee selection UI to TaskDetail modal (src/components/dashboard/TaskDetail.tsx)
  - Fetches all team/admin users on dialog open
  - Shows clickable pill buttons with avatar + name for each user
  - Selected assignees shown in primary color with X icon to remove
  - Unselected users shown in outline style to add
  - Calls /api/tasks/assignments POST/DELETE to toggle
  - Optimistic UI update with toast notifications
- Enhanced CreateTaskModal (src/components/dashboard/CreateTaskModal.tsx)
  - Auto-fetches team/admin users if no projectMembers passed
  - Replaced plain buttons with avatar pill buttons matching TaskDetail style
  - Shows selected count and checkmark icon
- Added assignee selection to AdminTasks detail dialog (src/features/admin-dashboard.tsx)
  - Same UI pattern as TaskDetail (avatar pills with toggle)
  - Fetches team users on mount, tracks assignee state per task
  - Refreshes task data after assignment change
- Fixed template literal JSX parsing issues by switching to cn() utility
- All lint and TypeScript checks pass for changed files

Stage Summary:
- TaskDetail: New "Assignees" section with toggle-able user pills
- CreateTaskModal: Improved assignee pills with avatars + auto-fetch fallback
- AdminTasks: New "Assignees" section in task detail dialog
- All three locations show team+admin users with avatar, name, selected state
- Uses existing /api/tasks/assignments POST/DELETE endpoints

---
Task ID: 4
Agent: main
Task: Put assignee selection in a modal/popover instead of inline pills

Work Log:
- Updated TaskDetail: Replaced inline pill buttons with a Popover triggered by clicking "Assignees (N)" header. Popover shows a scrollable list of all team/admin users with avatar, name, role, and checkbox. Current assignees shown as removable chips below the header.
- Updated AdminTasks: Same popover pattern as TaskDetail for consistency.
- Updated CreateTaskModal: Changed from horizontal pill layout to a vertical scrollable list inside a bordered container, matching the popover style (full-width rows with avatar, name, role, and check indicator).
- Added missing Check icon import to admin-dashboard.tsx.
- All lint and TypeScript checks pass.

Stage Summary:
- TaskDetail & AdminTasks: Click "Assignees (N)" → popover opens with user selection list. Selected users shown as removable chips below.
- CreateTaskModal: Inline scrollable list with same visual style (avatar + name + role + check circle).
- All three locations show: user avatar, name, role label (ADMIN/TEAM), and a filled/empty circle indicator.

---
Task ID: 1
Agent: Main Agent
Task: Fix message recipients display + add group messaging feature

Work Log:
- Explored all message-related code across the codebase (3 role-specific message panels, 1 API route, 1 Prisma model)
- Identified issues: no recipient info in chat headers, no group messaging, no search in admin messages, broken PATCH endpoint in team messages
- Added MessageGroup and GroupMember models to Prisma schema with proper relations
- Pushed schema to SQLite database
- Updated types/index.ts with MessageGroup, GroupMember interfaces
- Created /api/message-groups/route.ts (GET list, POST create)
- Created /api/message-groups/[id]/route.ts (GET detail, PATCH update members/name, DELETE)
- Rewrote /api/messages/route.ts to support both direct and group conversations in a single unified response
- Fixed Date serialization bug (Prisma returns Date objects that can't be serialized or compared with localeCompare)
- Built shared MessagesPanel component at src/components/messages/MessagesPanel.tsx with:
  - Unified conversation list (direct + group) sorted by most recent message
  - Search/filter for conversations
  - Create Group dialog with user search and multi-select
  - Group Info dialog for viewing/managing members (add/remove)
  - Group chat with sender names on each message
  - Direct chat showing recipient name, email, and role badge
  - Read receipts (check marks)
  - Proper loading skeletons and empty states
- Updated AdminMessages, TeamMessages, ClientMessages to use shared MessagesPanel
- Verified via browser: conversations load, search works, group created via API, group messages displayed correctly, direct message headers show recipient info

Stage Summary:
- Key files created: src/components/messages/MessagesPanel.tsx, src/app/api/message-groups/route.ts, src/app/api/message-groups/[id]/route.ts
- Key files modified: prisma/schema.prisma, src/types/index.ts, src/app/api/messages/route.ts, src/features/admin-dashboard.tsx, src/features/team-dashboard.tsx, src/features/client-dashboard.tsx
- All 3 dashboards now share a single, consistent messaging component with group chat support
- Date serialization fix applied to /api/messages conversation list endpoint

---
Task ID: 5
Agent: upload-api-agent
Task: Create file upload API for onboarding documents

Work Log:
- Created /home/z/my-project/src/app/api/upload/route.ts
- Handles POST multipart form data uploads
- Validates file types (pdf, png, jpg, jpeg, gif, webp, doc, docx, txt, svg) by MIME type and extension
- Limits file size to 10MB
- Saves to public/uploads/onboarding/ with unique filenames (timestamp + random hex)
- Creates uploads directory if it doesn't exist using fs/promises mkdir with recursive option
- Uses only standard Node.js APIs (fs/promises, crypto, path) and Next.js NextRequest
- Returns JSON with url, filename, originalName, size, and type on success

Stage Summary:
- Upload API ready at /api/upload
- Returns file URL path on success
---
Task ID: 1
Agent: main
Task: Fix Dialog z-index, redesign Client Onboarding, add file uploads, update admin review

Work Log:
- Fixed Dialog and AlertDialog z-index: bumped overlay to z-[100] and content to z-[101] in base components
- Removed redundant z-[100] from MessagesPanel dialog instances
- Created /src/components/onboarding/ClientOnboardingWizard.tsx with 4-step wizard UI
- Step 1: Business Information (name, email, phone, address, industry, company size)
- Step 2: Brand Assets (logo upload, brand colors, typography, brand guidelines upload)
- Step 3: Project Kickoff (goals, target audience, competitors, budget, timeline)
- Step 4: Document Submission (contract, payment, work order - all required PDF uploads)
- Created /api/upload route for file handling (POST multipart, type/size validation, unique filenames)
- Updated client-dashboard.tsx: replaced old ClientOnboarding with re-export of new wizard
- Updated admin-dashboard.tsx: submissions dialog now shows structured response fields and file attachments
- Added FileText to admin-dashboard icon imports

Stage Summary:
- Dialog z-index fix ensures all modals appear above DevTools overlay
- Client onboarding now matches reference UI: step navigation cards, progress bar, file upload zones, select dropdowns
- Admin can view structured field responses and click to download uploaded documents
- Upload API saves files to public/uploads/onboarding/ with unique names
- Verified: New Message dialog, Create Group dialog, message/conversation deletion all functional
- Lint passes with 0 errors (4 warnings for unused eslint-disable directives)

---
Task ID: 2
Agent: main
Task: Fix form overlap fields + Create onboarding form for admin

Work Log:
- Fixed z-index hierarchy for Select, Popover, and DropdownMenu: changed from z-50 to z-[200] so they render above Dialog overlays (z-[100]/z-[101])
- Fixed form field overlap in ClientOnboardingWizard: changed grid breakpoints from md: to sm: for two-column layouts, reduced spacing from space-y-2 to space-y-1.5, added w-full to SelectTrigger, reduced Textarea rows for better mobile layout
- Built "Create Onboarding Form" dialog in AdminOnboarding component with: title, description, project selector (fetches all projects), step selection (4 toggleable steps with checkmark cards)
- Added summary stat cards to AdminOnboarding: Total Forms, Published, Drafts, Pending Review
- Enhanced onboarding table: form icon, description preview, submission count badge, view/delete actions
- Added DELETE endpoint to /api/onboarding/[id] for deleting forms and their submissions
- Added form delete with confirmation AlertDialog in admin table
- Improved submissions dialog: better empty state, project color dot in header, sm: breakpoints for response grid, loading spinner for review buttons
- All lint checks pass (0 errors, 4 warnings)

Stage Summary:
- Select/Popover/DropdownMenu z-index: z-50 → z-[200] fixes overlap with Dialog overlays
- Onboarding wizard forms: proper single-column on mobile, two-column on sm+ breakpoints
- Admin "Create Onboarding" button opens dialog with project picker and step configuration
- Admin can delete onboarding forms with confirmation
- Verified via browser: Create Onboarding dialog works, project dropdown renders above dialog, form created successfully, client onboarding wizard fields properly spaced, Create Group dialog fully functional
---
Task ID: 1
Agent: Main Agent
Task: Fix subtask under team dashboard + add dark/light mode with blue primary color

Work Log:
- Verified subtask API was already fixed from previous session (GET handler added, PATCH accepts both id/subtaskId with toggle, DELETE supports query param)
- Verified ThemeProvider was already added to layout.tsx
- Verified blue primary CSS was already applied to globals.css
- Improved theme toggle: changed from click-cycle to dropdown menu (Light/Dark/System) in app-shell.tsx header
- Added theme toggle to login page with Sun/Moon/Monitor icons
- Updated admin dashboard buttons from hardcoded emerald-600 to bg-primary (blue)
- Updated admin overview stat cards to use primary color for "Total Tasks"
- Updated chart bar colors to use blue (#3b82f6) for "In Progress"
- Updated sidebar "Admin Access" shield icon to use text-primary (blue)
- Updated login page demo account colors with dark: variants
- Updated login page bottom badges to use text-primary for "Admin Panel"

Stage Summary:
- Subtask API: Fully functional - GET, POST (create), PATCH (toggle), DELETE all work
- Dark/Light mode: ThemeProvider wrapping app, dropdown toggle in header, toggle on login page
- Primary color: Blue (oklch blue ~264 hue) applied to all CSS variables, admin buttons, sidebar, stat cards

---
Task ID: 1
Agent: Main
Task: Fix client onboarding UI issues (from screenshot)

Work Log:
- Analyzed uploaded screenshot using VLM to identify UI issues
- Read ClientOnboardingWizard.tsx (938 lines) to understand the component structure
- Identified issues: (1) Step 3 "Main Competitors" used Textarea creating height mismatch with budget/timeline grid, (2) Read-only view had React node rendering issue with `||` operator mixing strings with JSX spans, (3) Field value boxes had inconsistent padding (p-2.5 vs p-3), (4) Submitted Documents section lacked proper grid layout
- Fixed Step 3: Changed "Main Competitors" from Textarea (rows={3}) to Input (single line), reduced parent spacing from space-y-5 to space-y-4
- Fixed read-only view: Added `as const` to field arrays, increased padding from p-2.5 to p-3, added min-h-[40px] for consistent field heights
- Fixed Documents section: Changed from vertical stack (space-y-2) to 3-column grid (grid grid-cols-1 md:grid-cols-3 gap-3), added min-w-0 and truncate for text overflow
- Verified with agent-browser: read-only view shows consistent field alignment, proper section separation, and clean 3-column document grid
- Ran lint: 0 errors, 4 pre-existing warnings

Stage Summary:
- File modified: /home/z/my-project/src/components/onboarding/ClientOnboardingWizard.tsx
- Key changes: Step 3 competitors field type, read-only view field consistency, documents grid layout
- Browser verification passed: clean professional layout confirmed

---
Task ID: 2
Agent: Main
Task: Add delete user icon in admin Users, add client owner to onboarding, filter client onboarding by business

Work Log:
- Added DELETE handler to /api/users/[id]/route.ts with activity log creation
- Added deleteId state and handleDeleteUser function to AdminUsers component
- Added "Delete User" menu item with Trash2 icon in the users table dropdown (red styling, disabled for self)
- Added clientId field to OnboardingForm in Prisma schema with optional relation to User
- Added clientOnboardingForms relation to User model
- Ran prisma db push and prisma generate
- Updated /api/onboarding GET to accept ?clientId= query param for filtering
- Updated /api/onboarding POST to accept and store clientId
- Updated /api/onboarding/[id] GET to include client in response
- Updated OnboardingForm TypeScript type to include clientId and client
- Updated AdminOnboarding component:
  - Added clients state and fetchClients to load active client users
  - Added Client Owner selector (Select with avatar + name + company) in create dialog
  - Made clientId required for form creation
  - Added Client Owner column in onboarding forms table
  - Pass clientId in handleCreateOnboarding
- Updated ClientOnboardingWizard fetchForms to pass ?clientId=${user.id}
- Updated client-dashboard.tsx handleCreateOnboarding to pass clientId: user?.id
- All lint checks pass (0 errors, 4 pre-existing warnings)
- API tests verified: admin GET returns all forms, client GET filters by clientId, users list works

Stage Summary:
- Files modified:
  - prisma/schema.prisma (added clientId to OnboardingForm, relation to User)
  - src/types/index.ts (added clientId to OnboardingForm interface)
  - src/app/api/users/[id]/route.ts (added DELETE handler)
  - src/app/api/onboarding/route.ts (added clientId filtering in GET, clientId in POST)
  - src/app/api/onboarding/[id]/route.ts (added client to include)
  - src/features/admin-dashboard.tsx (delete user button, client owner in onboarding)
  - src/features/client-dashboard.tsx (pass clientId in onboarding creation)
  - src/components/onboarding/ClientOnboardingWizard.tsx (filter by clientId)
- Key design: Each onboarding form is assigned to a specific client via clientId. The client dashboard only fetches forms where clientId matches the logged-in user's ID. Admin can see all forms and manages client assignments.

---
Task ID: 5
Agent: Main
Task: Add edit functionality to Onboarding Management (after creating onboarding)

Work Log:
- Updated /api/onboarding/[id] PATCH handler to support editing all form fields: title, description, stepsJson, status, projectId, clientId
- Added activity log creation on form update
- Added `Pencil` icon import to admin-dashboard.tsx
- Added edit state variables: editOpen, editing, editFormId, editForm
- Added openEditDialog function that parses stepsJson and pre-fills the edit form
- Added handleEditOnboarding function that PATCHes the form with updated data
- Added Pencil edit button in the onboarding table actions column (between Eye and Trash), with Tooltip
- Widened actions column from w-24 to w-28 to accommodate 3 buttons
- Created Edit Onboarding Dialog with same layout as Create dialog: title, description, project selector, client owner selector (with "No client assigned" option), step selection cards
- Edit dialog pre-fills all fields from the existing form data
- Client owner in edit dialog allows unsetting (via "_none" value mapped to null)
- Verified via agent-browser: Edit dialog opens with pre-filled data, title change saved successfully, table shows 3 action buttons (Eye, Pencil, Trash)
- VLM screenshot analysis confirmed clean UI with proper buttons and no visual issues
- Lint: 0 errors (4 pre-existing warnings)

Stage Summary:
- Files modified: src/app/api/onboarding/[id]/route.ts, src/features/admin-dashboard.tsx
- Admin Onboarding table now has 3 action buttons per row: View (Eye), Edit (Pencil), Delete (Trash)
- Edit dialog pre-fills all form fields and allows full editing of title, description, project, client owner, and steps

---
Task ID: 6
Agent: Main
Task: Fix Team Dashboard Tasks section

Work Log:
- Identified 5 bugs through code analysis and browser testing:
  1. Task creation completely broken - missing `createdById` and wrong field name (`assigneeId` vs `assigneeIds`)
  2. Task filtering too restrictive - only showed tasks assigned to current user, not all project tasks
  3. Empty page when team member has no projects - rendered nothing instead of empty state
  4. PATCH API used truthy check for status/priority - `status && { status }` fails for empty/falsy values
  5. No way to edit task title or description in detail dialog
- Fixed task creation: Added `createdById: user.id`, changed `assigneeId` to `assigneeIds: [cAssignee]`, added error response handling
- Fixed task filtering: Removed `assigneeId` param from fetchTasks, now fetches all project tasks
- Added empty state component when no projects (reuses existing EmptyState with FolderKanban icon)
- Fixed PATCH /api/tasks/[id]: Changed from `status && { status }` to `status !== undefined && { status }` for all fields
- Added inline title editing: Click title -> Input appears -> Enter/blur saves, Escape cancels
- Added editable description: Replaced read-only p tag with Textarea that auto-saves on blur
- Added editTitle/editDesc/isEditingTitle state variables
- Updated handleUpdateTask to sync local edit state with saved data
- Added proper error response checking for handleDeleteTask and handleAddSubtask
- Re-seeded database (db push --force-reset + prisma db seed) since previous data was corrupted
- Verified all fixes via agent-browser:
  - Task creation works (new task appears in board)
  - All 8 Website Redesign tasks visible across 4 columns
  - Inline title editing saves correctly with toast
  - Delete task works with confirmation dialog
  - List view shows all tasks correctly
- Lint: 0 errors (4 pre-existing warnings)

Stage Summary:
- Files modified: src/features/team-dashboard.tsx, src/app/api/tasks/[id]/route.ts
- Key fixes: Task creation (createdById + assigneeIds), task filtering (all project tasks), PATCH API (undefined checks), inline title/description editing, empty state for no projects
- All task CRUD operations verified working for team dashboard

---
Task ID: 2
Agent: Main
Task: Add edit user and reset password functionality to Admin User Management

Work Log:
- Enhanced /api/users PATCH endpoint: Changed from conditional spread to explicit updateData builder. Now supports updating name, email, phone, company, role, status. Added email uniqueness check.
- Added PATCH handler to /api/users/[id]/route.ts for password reset. Validates admin role, hashes new password, creates activity log.
- Added `KeyRound` icon import to admin-dashboard.tsx
- Added edit state variables: editOpen, editing, editForm (id, name, email, role, phone, company)
- Added reset password state variables: resetOpen, resetting, resetTarget, resetPassword, resetConfirm
- Added `openEditDialog(u)` function that pre-fills edit form from user data
- Added `handleEditUser(e)` function that PATCHes to /api/users
- Added `openResetDialog(u)` function that sets reset target
- Added `handleResetPassword(e)` function that validates and PATCHes to /api/users/[id]
- Added 2 new DropdownMenuItems in user actions: "Edit User" (Pencil icon) and "Reset Password" (KeyRound icon)
- Created Edit User Dialog: pre-filled name, email, role, phone, company fields with Save/Cancel buttons
- Created Reset Password Dialog: amber-themed with warning banner, new password + confirm fields, "Reset Password" amber button
- Verified via browser: dropdown shows 4 menu items, Edit dialog pre-fills correctly, Edit saves and updates table (Emma Wilson company changed from "—" to "TaskFlow Team"), Reset Password dialog shows with amber theme and warning, Password reset returns 200 and creates activity log
- Lint: 0 errors (4 pre-existing warnings)

Stage Summary:
- Files modified: src/app/api/users/route.ts, src/app/api/users/[id]/route.ts, src/features/admin-dashboard.tsx
- Admin user dropdown now has 4 options: Edit User, Reset Password, Deactivate/Activate, Delete User
- Edit User dialog allows changing name, email, role, phone, company
- Reset Password dialog with amber warning theme, validates min 6 chars and password match
- All operations verified working end-to-end

---
Task ID: 3
Agent: Main
Task: Fix hydration error in Add User dialog + verify edit/reset password functionality

Work Log:
- Analyzed uploaded screenshot via VLM: identified hydration error in Add User dialog caused by browser extension injecting `fdprocessedid` attribute on password input elements
- Found that Edit User and Reset Password functionality were already implemented from previous session (Task ID: 2)
- Fixed hydration error: Added `suppressHydrationWarning` to all password Input fields in Add User dialog and Reset Password dialog
- Verified via agent-browser end-to-end:
  - Login as admin@taskflow.com / admin123
  - Add User dialog opens without hydration error
  - Created test user successfully
  - Edit User dialog opens with pre-filled data, saves correctly
  - Reset Password dialog works with amber warning theme
  - Delete User works with confirmation
  - No browser console errors
  - Dev log shows all API calls returning 200
- Lint: 0 errors (4 pre-existing warnings)

Stage Summary:
- File modified: src/features/admin-dashboard.tsx (added suppressHydrationWarning to 4 password Input fields)
- Hydration error fixed: password inputs no longer cause mismatch between server and client HTML
- All User Management features verified: Add, Edit, Reset Password, Deactivate/Activate, Delete

---
Task ID: 1
Agent: Main
Task: Fix error in Team Dashboard task section

Work Log:
- Used agent-browser to reproduce: clicking Tasks tab in team dashboard shows "Application error: a client-side exception has occurred"
- Took screenshot and analyzed with VLM: revealed exact error "Runtime ReferenceError: Cannot access 'currentProject' before initialization" at team-dashboard.tsx line 953
- Root cause: `projectMembers` (line 953) referenced `currentProject` (line 973) before it was declared — a JavaScript temporal dead zone error caused by an early return block between them
- Fix 1: Moved `const currentProject = projects.find(...)` from line 973 to line 952, before the `projectMembers` usage
- Fix 2: Also found and fixed /api/projects/[id]/route.ts which used `assignees` (wrong relation name) instead of `assignments` in the Prisma include, causing 500 errors. Added `assignees: t.assignments` mapping in response.
- Also fixed all non-admin user passwords (they had wrong hash from seed data)
- Verified via agent-browser: Tasks tab now loads with kanban board, list view works, task detail dialog opens, project switching works, no console errors
- Lint: 0 errors (4 pre-existing warnings)

Stage Summary:
- Files modified: src/features/team-dashboard.tsx (moved currentProject declaration), src/app/api/projects/[id]/route.ts (fixed assignees→assignments relation name, added assignees mapping)
- Root cause: Temporal dead zone — variable referenced before its `const` declaration due to an early return block placement
---
Task ID: 2-b
Agent: upload-api-agent
Task: Create file upload API for onboarding documents

Work Log:
- Created /home/z/my-project/src/app/api/upload/route.ts with POST endpoint
- Accepts multipart form data with a 'file' field
- Validates file types via both extension and MIME type mapping: pdf, png, jpg, jpeg, gif, webp, doc, docx, txt, svg
- Enforces 10MB file size limit with descriptive error message
- Saves files to /home/z/my-project/public/uploads/onboarding/ with unique filenames (timestamp + 8-byte random hex)
- Creates the uploads directory recursively if it doesn't exist using fs/promises mkdir
- Uses only standard Node.js APIs (fs/promises, crypto, path) and Next.js NextRequest
- Returns JSON response: { url, filename, originalName, size, type }
- Includes proper error handling: missing file, size exceeded, type mismatch, server errors
- Ensured /home/z/my-project/public/uploads/onboarding/ directory exists
- Lint passed with 0 errors (4 pre-existing warnings)

Stage Summary:
- Upload API ready at POST /api/upload
- Validates file type (extension + MIME consistency) and size (10MB max)
- Generates unique filenames: {timestamp}-{16hex}{ext}
- Returns public URL path (/uploads/onboarding/{filename})

---
Task ID: 1
Agent: Main
Task: Add Save button to Task Detail + Download button for Onboarding Management

Work Log:
- **Task Save Button (team-dashboard.tsx)**:
  - Removed all auto-save behavior: Status select, Priority select, Due Date calendar, Description textarea, and Title inline edit no longer call API on change
  - Added `hasChanges` computed boolean that compares all editable fields (title, description, status, priority, dueDate) against the original task
  - Replaced `handleUpdateTask` (auto-save) with `handleSaveTask` (batch save) that collects all changed fields into a single PATCH request
  - Added `handleDiscardChanges` function that resets all edit state to the original task values
  - Added "Unsaved changes" amber warning indicator that appears when changes are detected
  - Added "Discard" button (outline, with RotateCcw icon) that appears only when there are changes
  - Added "Save Changes" button (primary, with Save icon) that is disabled when no changes exist
  - Kept Delete button (destructive) alongside the new save controls
  - Added Save and RotateCcw icon imports from lucide-react

- **Onboarding Download (admin-dashboard.tsx + API)**:
  - Created /api/onboarding/download/route.ts GET endpoint that:
    - Accepts `submissionId` query parameter
    - Fetches submission with client, form, project, and reviewer relations
    - Parses responsesJson to extract form fields and uploaded file references
    - Generates a formatted plain-text report with: form info, client info, all submitted data fields, uploaded document details (name, size, type, URL), review status
    - Returns as text/plain with Content-Disposition attachment header
  - Added Download icon import to admin-dashboard.tsx
  - Added "Download Report" button (outline variant) to each submission card in the submissions review dialog
  - Button opens the download URL in a new tab via window.open()

- Also created /api/upload/route.ts (by sub-agent) for file upload support

Stage Summary:
- Files modified: src/features/team-dashboard.tsx, src/features/admin-dashboard.tsx
- Files created: src/app/api/onboarding/download/route.ts, src/app/api/upload/route.ts
- Task detail: Changes are now local-only until "Save Changes" is clicked. "Discard" reverts. "Unsaved changes" indicator shown.
- Onboarding: Admin can download any submitted onboarding as a formatted text report via "Download Report" button
