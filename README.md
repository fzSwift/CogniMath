# CogniMath Teacher Dashboard

Teacher-only web dashboard for **CogniMath: An Adaptive Learning Platform for Foundational Algebra**.  
Built with React, Vite, TypeScript, Tailwind CSS, Supabase, React Router, and Recharts.

## Features

- Teacher registration and login with Supabase Auth
- Protected dashboard routes
- Class creation, **edit**, **archive** (soft hide), restore, and optional permanent delete
- Class list: **search/sort**, counts (students / question sets / pending joins), **copy invite code**, deep-link to pending requests
- Class detail: **health strip** (avg score, pass rate, last activity), **analytics deep link** (`?classId=`)
- Class invite code + QR for Unity students; pending join requests teachers approve or reject
- Students: metrics list with **name · class** labels (enrolled classes you teach), filter by class / search by class name, sort, archive/restore; **create student requires picking a class** (RPC enrolls in one transaction); student detail: edit profile, learning snapshot, weak topics per learner, permanent delete with cascade warning
- Question set creation with threshold score
- Question management by difficulty and sequence
- Student attempts and selected/correct answer review
- Analytics (performance charts, pass/fail, weak topics, recommendations)

## Project Structure

```txt
src/
├── components/
│   ├── charts/
│   ├── layout/
│   └── ui/
├── hooks/
├── lib/
├── pages/
├── routes/
├── types/
├── App.tsx
└── main.tsx
```

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a Supabase project at [https://supabase.com](https://supabase.com).

3. In Supabase SQL Editor, run:
   - `supabase/schema.sql` (full schema for new projects: tables, RLS, triggers, RPCs, leaderboard)
   - `supabase/seed.sql` (optional sample data)

   If you already applied an older schema, run only what you are missing, in a sensible order:

   - `supabase/upgrade_join_codes.sql`
   - `supabase/upgrade_class_features.sql` (archived classes, `class_dashboard_row`, analytics `class_id` on views)
   - `supabase/upgrade_students_features.sql` (`students.archived_at`, `student_teacher_metrics`, `weak_topics_view.student_id`, roster counts, teacher delete on students)
   - `supabase/upgrade_analytics_views.sql` (`class_performance_view.question_set_id` for analytics links / CSV)
   - `supabase/upgrade_leaderboard_teacher_rls.sql` (if leaderboard `SELECT` was still fully open — restrict reads to the class teacher)
   - `supabase/upgrade_student_answers_delete_policy.sql` (only if deleting questions fails under RLS)
   - `supabase/upgrade_create_student_for_class.sql` (teacher **Students** page: `create_student_for_class` RPC — create + enroll atomically)
   - `supabase/upgrade_bootstrap_teacher_workspace.sql` (`bootstrap_teacher_workspace` RPC — ensure `profiles` row + starter class if teacher has none)
   - `supabase/upgrade_admin_teacher_isolation.sql` (`created_by_teacher_id`, stricter student visibility, admin RLS, RPC/view updates)
   - `supabase/upgrade_class_owner_question_set_rls.sql` (question sets / attempts / answers / progress scoped by **class owner** — not only `question_sets.teacher_id`)
   - `supabase/upgrade_student_teacher_metrics_class_names.sql` (adds `enrolled_class_names` to `student_teacher_metrics` for dashboard **Name · class** labels; safe after any prior `student_teacher_metrics` definition)
   - `supabase/upgrade_profiles_role_guard_sql_editor.sql` (only if `UPDATE profiles SET role` fails in SQL Editor on an older DB — allows role changes when `auth.uid()` is null)
   - `supabase/promote_admin.sql` (reference: promote/demote `profiles.role` by UUID or email)

   Optional bulk question banks (replace UUID placeholders, then run in SQL Editor):

   - `supabase/seed_subtraction_basics_for_class.sql`
   - `supabase/seed_multiplication_basics_for_class.sql`
   - `supabase/seed_division_basics_for_class.sql`

4. Create `.env` in project root from `.env.example`:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

5. Start development server:

```bash
npm run dev
```

## Supabase Notes

### Auth confirmation links (production)

Signup sends `emailRedirectTo` so the confirmation button uses whatever origin the user registered from (e.g. [https://cogni-math.vercel.app](https://cogni-math.vercel.app/) in production).

You still must allow that URL in the Supabase project:

1. Open **Authentication → URL Configuration** in the [Supabase Dashboard](https://supabase.com/dashboard).
2. Set **Site URL** to your primary deployed URL, e.g. `https://cogni-math.vercel.app`.
3. Under **Redirect URLs**, add:
   - `https://cogni-math.vercel.app/**`
   - `http://localhost:5173/**` (or your local dev port) so confirmation works locally too.

Without those redirects on the allow list, Supabase may block or ignore `emailRedirectTo`.

---

- `src/lib/supabase.ts` initializes the Supabase client from environment variables (teacher dashboard uses the **anon** publishable key with **authenticated** sessions after login).
- `schema.sql` includes tables, RLS, the auth trigger that creates a **teacher** profile, invite codes and join-request RPCs, analytics views, leaderboard tables/views/trigger, and helper functions used by policies.
- **Teachers** (`authenticated`): RLS limits reads and writes to classes, question sets, students, attempts, and related data they own or that belong to their enrollments.
- **Game clients (e.g. Unity)** should use the **anon** key with the policies intended for play: read **active** question sets and questions; insert/update attempts, answers, and progress only when the `student_id` is **enrolled** in the question set’s class and the class/set are active. Join requests use `submit_class_join_request` (anon allowed).

### Multi-tenant isolation (teachers vs admin)

- **`teacher`** accounts (default at signup) only see rows tied to them: classes where `teacher_id` is their profile id; join requests for those classes; **students** enrolled in their classes or created by them (`students.created_by_teacher_id`); and question sets / attempts / answers / progress for sets whose **`class_id` belongs to a class they own** (another teacher cannot attach sets to your class and see that data).
- **`admin`** accounts see and manage **everything** via extra policies (`is_admin()` reads `profiles.role = 'admin'`). New signups get **`teacher`** by default.
- To **create an admin**: apply **`supabase/upgrade_admin_teacher_isolation.sql`** (or full `schema.sql`) first, then in the SQL Editor run the steps in **`supabase/promote_admin.sql`** (by user UUID or email). The `profiles_role_guard` trigger allows that `UPDATE` when the editor session has no JWT (`auth.uid()` is null); from the app, only an existing admin can change `profiles.role`.

```sql
-- Example: promote one user (UUID from Supabase → Authentication → Users)
update public.profiles set role = 'admin' where id = '<paste-user-uuid>';
```

On older databases, if promotion in the SQL Editor still errors, run **`supabase/upgrade_profiles_role_guard_sql_editor.sql`** once.

### Teacher workspace bootstrap

After login, protected routes call `bootstrap_teacher_workspace` once per session. It inserts a missing **`profiles`** row (fixes `classes_teacher_id_fkey` when the auth trigger did not run) and creates **My class** when the teacher has **no class rows at all** (including archived). Rename or archive that class under **Classes** if you like.

### Teacher: create student + enroll

The dashboard calls `create_student_for_class` so each new student is always inserted **and** linked via `class_students` in one transaction. Requires at least one non-archived class.

### Unity / student join flow

1. Teacher opens **Class detail**, generates an **invite code** (QR encodes the same code string).
2. From the Unity client (**anon** key), call:

```js
const { data, error } = await supabase.rpc('submit_class_join_request', {
  p_invite_code: 'CODE_FROM_TEACHER',
  p_full_name: 'Student Name',
  p_username: 'unique_username',
})
```

3. Teacher sees the request under **Pending join requests** and clicks **Approve** or **Reject**.  
   Approve creates or updates the `students` row and adds `class_students`.

## Routes

- `/login`
- `/register`
- `/dashboard`
- `/classes`
- `/classes/:id`
- `/students`
- `/question-sets`
- `/question-sets/:id`
- `/analytics`
- `/leaderboard`
- `/student-results/:studentId`
- `/settings`
