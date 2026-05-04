-- Create / assign the platform admin role (`profiles.role = 'admin'`).
-- Run in Supabase: SQL Editor as postgres (or any role that bypasses RLS on `public.profiles`).
-- The `profiles_role_guard` trigger allows role changes when `auth.uid()` is null, so these UPDATEs work here.
--
-- Effects (after `upgrade_admin_teacher_isolation.sql` is applied):
--   - That user sees all teachers’ classes, students, attempts, etc. (RLS `is_admin()` policies).
--   - Only an admin may change `profiles.role` on someone else (trigger `profiles_role_guard`).
--
-- 1) Find a user id: Dashboard → Authentication → Users → copy UUID for the account you trust.

-- update public.profiles set role = 'admin' where id = 'PASTE-USER-UUID-HERE';

-- 2) Or promote by the email they used to sign up:

-- update public.profiles p
-- set role = 'admin'
-- from auth.users u
-- where u.id = p.id
--   and lower(u.email) = lower('admin@yourschool.edu');

-- 3) Demote back to a normal teacher account:

-- update public.profiles set role = 'teacher' where id = 'USER-UUID-HERE';

-- Optional: enforce only `teacher` | `admin` at the database (safe to re-run).

alter table public.profiles drop constraint if exists profiles_role_check;

alter table public.profiles add constraint profiles_role_check check (role in ('teacher', 'admin'));
