
# Role-Based Access Control Plan

## Roles
- **admin** — full access; manages users, roles, departments; all cases
- **department_head** — full case management within own department; cannot reopen closed cases; cannot manage users/roles
- **employee** — read-only on cases assigned to them

## 1. Database (single migration)

**New enum & tables**
- `app_role` enum: `admin`, `department_head`, `employee`
- `departments` — id, name (unique)
- `user_roles` — user_id, role, department_id (nullable; required for department_head/employee)
- `case_assignments` — case_id, user_id, assigned_by, assigned_at (many-to-many)
- `case_audit_log` — case_id, user_id, user_role, action, previous_status, new_status, remarks, created_at
- Add `department_id` (uuid, FK) to `cases`

**Security definer functions**
- `has_role(_user_id, _role)` — boolean
- `is_admin(_user_id)` — boolean
- `get_user_department(_user_id)` — uuid
- `can_access_case(_user_id, _case_id)` — boolean (admin, same dept head, or assignee)

**RLS policies (replaces current "own cases only" policies)**
- `cases` SELECT: admin all; dept_head where `department_id = get_user_department(uid)`; employee where exists assignment
- `cases` INSERT: admin, dept_head (dept_head forced to own department via trigger)
- `cases` UPDATE: admin any; dept_head own dept, but blocked from reopening closed → open unless admin (enforced by trigger)
- `cases` DELETE: admin only
- `case_assignments`: admin + dept_head (own dept) manage; employees read own
- `case_audit_log`: admin read all; dept_head read own dept; employees read logs for assigned cases; INSERT allowed for authenticated (writes come from trigger)
- `user_roles`: admin manage; everyone read own
- `departments`: admin manage; authenticated read

**Audit trigger** on `cases` INSERT/UPDATE writes to `case_audit_log` capturing old/new status and acting user.

**Bootstrap first admin**: whoever signs up first becomes admin (guarded by a trigger that only fires if no admin exists yet). Subsequent users default to `employee` with no department until an admin assigns one.

## 2. Backend (server functions)

New `src/lib/admin.functions.ts` (all use `requireSupabaseAuth` + `has_role` check):
- `listUsers`, `updateUserRole`, `assignUserToDepartment`
- `createDepartment`, `listDepartments`
- `assignCaseToUsers`, `unassignCase`
- `reopenCase` (admin only)

Client-side reads continue to use the browser Supabase client, protected by RLS.

## 3. Frontend

**Auth context helper** `src/hooks/useCurrentRole.ts` — fetches `user_roles` + department for the signed-in user; exposes `{ role, departmentId, isAdmin, isDeptHead, isEmployee, canEdit(case), canReopen }`.

**Dashboard (`CaseTracker`)**
- Employees: read-only view, no Register/Edit/Delete/Toggle buttons; only assigned cases visible
- Dept heads: manage cases in dept; toggle open/closed but reopen button disabled once closed
- Admins: all actions + extra "Users" and "Departments" nav links
- Show role badge next to profile

**Registration form (`/register-letter`)**
- Employees redirected away (permission denied)
- Dept heads: department field locked to their own
- Admins: can pick any department + assign responsible person

**New admin-only routes** under `_authenticated/`
- `/admin/users` — list users, change role, assign department
- `/admin/departments` — CRUD departments
- `/admin/audit` — audit trail viewer (admin sees all; dept_head sees dept)

**Case detail additions**
- "Assignments" section (admin/dept_head can add/remove; employees see list)
- "Audit history" panel showing every logged action

## 4. Technical details

- All role checks happen both in RLS (source of truth) and UI (for hiding controls).
- Reopen restriction implemented via BEFORE UPDATE trigger: if old.status='closed' and new.status='open' and not admin → RAISE EXCEPTION.
- Department scoping for dept_head INSERT: BEFORE INSERT trigger sets/validates `department_id = get_user_department(uid)`.
- Audit log written by AFTER INSERT/UPDATE trigger using `auth.uid()` and their role at time of action.
- Existing cases without a `department_id` will be nullable; admin can backfill from the users page.

## Files to add/modify

Created:
- migration (schema + RLS + triggers + bootstrap)
- `src/lib/admin.functions.ts`, `src/lib/admin.server.ts`
- `src/hooks/useCurrentRole.ts`
- `src/routes/_authenticated/admin/users.tsx`
- `src/routes/_authenticated/admin/departments.tsx`
- `src/routes/_authenticated/admin/audit.tsx`
- `src/components/case-tracker/AssignmentsPanel.tsx`
- `src/components/case-tracker/AuditHistory.tsx`

Modified:
- `src/components/case-tracker/CaseTracker.tsx` (role-gated UI, admin nav)
- `src/routes/_authenticated/register-letter.tsx` (role gates, department lock)
- `src/routes/auth.tsx` (department becomes a select from `departments` table)

## Open questions before I build

1. First-admin bootstrap: OK with "first signup = admin"? Alternative: seed a specific email in the migration.
2. Should dept heads be able to **create** new users in their department, or is user creation strictly admin-only? (Spec says admin-only — confirming.)
3. Any preference for how "assigned to user" is represented — single assignee (simpler, reuses existing `responsible_person` text field converted to FK) or multi-assignee (new join table, more flexible)? Plan above uses multi-assignee.
