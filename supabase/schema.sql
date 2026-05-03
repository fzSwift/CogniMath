create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role text default 'teacher',
  created_at timestamp with time zone default now()
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references public.profiles (id) on delete cascade,
  class_name text not null,
  description text,
  invite_code text,
  archived_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  username text unique not null,
  class_level text,
  archived_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

create table if not exists public.class_students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references public.classes (id) on delete cascade,
  student_id uuid references public.students (id) on delete cascade,
  created_at timestamp with time zone default now(),
  unique (class_id, student_id)
);

create table if not exists public.class_join_requests (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references public.classes (id) on delete cascade not null,
  full_name text not null,
  username text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamp with time zone default now()
);

create unique index if not exists class_join_requests_one_pending_per_student
  on public.class_join_requests (class_id, lower(username))
  where status = 'pending';

create table if not exists public.question_sets (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references public.profiles (id) on delete cascade,
  class_id uuid references public.classes (id) on delete cascade,
  title text not null,
  topic text not null,
  description text,
  threshold_score integer default 70,
  is_active boolean default true,
  created_at timestamp with time zone default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  question_set_id uuid references public.question_sets (id) on delete cascade,
  question_text text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  correct_answer text not null,
  difficulty_level integer not null check (difficulty_level between 1 and 5),
  sequence_order integer not null,
  points integer default 10,
  created_at timestamp with time zone default now()
);

create table if not exists public.student_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students (id) on delete cascade,
  question_set_id uuid references public.question_sets (id) on delete cascade,
  difficulty_level integer not null,
  score integer not null,
  total_questions integer not null,
  percentage numeric(5, 2) not null,
  passed boolean not null,
  started_at timestamp with time zone default now(),
  completed_at timestamp with time zone default now()
);

create table if not exists public.student_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid references public.student_attempts (id) on delete cascade,
  student_id uuid references public.students (id) on delete cascade,
  question_id uuid references public.questions (id) on delete cascade,
  selected_answer text not null,
  correct_answer text not null,
  is_correct boolean not null,
  answered_at timestamp with time zone default now()
);

create table if not exists public.student_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students (id) on delete cascade,
  question_set_id uuid references public.question_sets (id) on delete cascade,
  current_difficulty_level integer default 1,
  total_points integer default 0,
  highest_score numeric(5, 2) default 0,
  updated_at timestamp with time zone default now(),
  unique (student_id, question_set_id)
);

alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.class_students enable row level security;
alter table public.question_sets enable row level security;
alter table public.questions enable row level security;
alter table public.student_attempts enable row level security;
alter table public.student_answers enable row level security;
alter table public.student_progress enable row level security;
alter table public.class_join_requests enable row level security;

alter table public.classes add column if not exists invite_code text;
alter table public.classes add column if not exists archived_at timestamp with time zone;
alter table public.students add column if not exists archived_at timestamp with time zone;

create unique index if not exists classes_invite_code_key on public.classes (invite_code)
  where invite_code is not null;

alter table public.students add column if not exists created_by_teacher_id uuid references public.profiles (id) on delete set null;
create index if not exists students_created_by_teacher_idx on public.students (created_by_teacher_id)
  where created_by_teacher_id is not null;

-- RLS helpers (SECURITY DEFINER so checks do not recurse through profiles policies).
create or replace function public.is_admin() returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

create or replace function public.is_teacher_account() returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('teacher', 'admin')
  );
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.is_teacher_account() from public;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_teacher_account() to authenticated;

-- Enrollment + active class/set; used by RLS for anon (Unity) play paths.
create or replace function public.student_can_use_question_set(p_student_id uuid, p_question_set_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.question_sets qs
    join public.class_students cs on cs.class_id = qs.class_id and cs.student_id = p_student_id
    join public.students st on st.id = cs.student_id
    join public.classes c on c.id = qs.class_id
    where qs.id = p_question_set_id
      and qs.is_active = true
      and st.archived_at is null
      and c.archived_at is null
  );
$$;

create or replace function public.student_answer_insert_is_valid(
  p_attempt_id uuid,
  p_student_id uuid,
  p_question_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.student_attempts sa
    join public.questions q on q.id = p_question_id and q.question_set_id = sa.question_set_id
    join public.question_sets qs on qs.id = sa.question_set_id
    join public.class_students cs on cs.class_id = qs.class_id and cs.student_id = p_student_id
    join public.students st on st.id = cs.student_id
    join public.classes c on c.id = qs.class_id
    where sa.id = p_attempt_id
      and sa.student_id = p_student_id
      and qs.is_active = true
      and st.archived_at is null
      and c.archived_at is null
  );
$$;

revoke all on function public.student_can_use_question_set(uuid, uuid) from public;
revoke all on function public.student_answer_insert_is_valid(uuid, uuid, uuid) from public;
grant execute on function public.student_can_use_question_set(uuid, uuid) to anon;
grant execute on function public.student_answer_insert_is_valid(uuid, uuid, uuid) to anon;

create policy "teacher reads own profile" on public.profiles
for select using (id = auth.uid());

create policy "teacher updates own profile" on public.profiles
for update using (id = auth.uid());

create or replace function public.enforce_profile_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') then
      raise exception 'Only an admin may change profiles.role';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_role_guard on public.profiles;
create trigger profiles_role_guard
before update on public.profiles
for each row execute function public.enforce_profile_role_change();

create policy "teacher manages own classes" on public.classes
for all using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

create policy "teacher can read students in own classes" on public.students
for select using (
  created_by_teacher_id = auth.uid()
  or exists (
    select 1
    from public.class_students cs
    join public.classes c on c.id = cs.class_id
    where cs.student_id = students.id and c.teacher_id = auth.uid()
  )
);

create policy "teacher can create students" on public.students
for insert with check (public.is_teacher_account());

create policy "teacher can update students in own classes" on public.students
for update using (
  created_by_teacher_id = auth.uid()
  or exists (
    select 1
    from public.class_students cs
    join public.classes c on c.id = cs.class_id
    where cs.student_id = students.id and c.teacher_id = auth.uid()
  )
);

create policy "teacher deletes students in own classes" on public.students
for delete using (
  exists (
    select 1
    from public.class_students cs
    join public.classes c on c.id = cs.class_id
    where cs.student_id = students.id and c.teacher_id = auth.uid()
  )
  or (
    created_by_teacher_id = auth.uid()
    and not exists (
      select 1
      from public.class_students cs2
      join public.classes c2 on c2.id = cs2.class_id
      where cs2.student_id = students.id
        and c2.teacher_id is distinct from auth.uid()
    )
  )
);

create policy "teacher manages class_students for own classes" on public.class_students
for all using (
  exists (
    select 1 from public.classes c
    where c.id = class_students.class_id and c.teacher_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.classes c
    where c.id = class_students.class_id and c.teacher_id = auth.uid()
  )
);

create policy "teacher reads join requests for own classes" on public.class_join_requests
for select using (
  exists (
    select 1 from public.classes c
    where c.id = class_join_requests.class_id and c.teacher_id = auth.uid()
  )
);

create policy "teacher manages own question sets" on public.question_sets
for all using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

drop policy if exists "anon can read active question sets" on public.question_sets;
create policy "anon can read active question sets" on public.question_sets
for select to anon
using (is_active = true);

create policy "teacher manages questions from own sets" on public.questions
for all using (
  exists (
    select 1 from public.question_sets qs
    where qs.id = questions.question_set_id and qs.teacher_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.question_sets qs
    where qs.id = questions.question_set_id and qs.teacher_id = auth.uid()
  )
);

drop policy if exists "anon can read questions in active sets" on public.questions;
create policy "anon can read questions in active sets" on public.questions
for select to anon
using (
  exists (
    select 1 from public.question_sets qs
    where qs.id = questions.question_set_id and qs.is_active = true
  )
);

create policy "teacher reads attempts for own classes" on public.student_attempts
for select using (
  exists (
    select 1
    from public.question_sets qs
    where qs.id = student_attempts.question_set_id and qs.teacher_id = auth.uid()
  )
);

create policy "teacher manages attempts for own classes" on public.student_attempts
for all using (
  exists (
    select 1
    from public.question_sets qs
    where qs.id = student_attempts.question_set_id and qs.teacher_id = auth.uid()
  )
) with check (
  exists (
    select 1
    from public.question_sets qs
    where qs.id = student_attempts.question_set_id and qs.teacher_id = auth.uid()
  )
);

drop policy if exists "client inserts attempt when enrolled" on public.student_attempts;
create policy "client inserts attempt when enrolled" on public.student_attempts
for insert to anon
with check (public.student_can_use_question_set(student_id, question_set_id));

drop policy if exists "client updates attempt when enrolled" on public.student_attempts;
create policy "client updates attempt when enrolled" on public.student_attempts
for update to anon
using (public.student_can_use_question_set(student_id, question_set_id))
with check (public.student_can_use_question_set(student_id, question_set_id));

create or replace function public.student_attempt_immutable_ids()
returns trigger
language plpgsql
as $$
begin
  if new.student_id is distinct from old.student_id
     or new.question_set_id is distinct from old.question_set_id then
    raise exception 'student_id and question_set_id cannot change on student_attempts';
  end if;
  return new;
end;
$$;

drop trigger if exists student_attempt_immutable_ids on public.student_attempts;
create trigger student_attempt_immutable_ids
before update on public.student_attempts
for each row execute function public.student_attempt_immutable_ids();

create policy "teacher reads answers for own classes" on public.student_answers
for select using (
  exists (
    select 1
    from public.student_attempts sa
    join public.question_sets qs on qs.id = sa.question_set_id
    where sa.id = student_answers.attempt_id and qs.teacher_id = auth.uid()
  )
);

create policy "teacher deletes answers for own classes" on public.student_answers
for delete using (
  exists (
    select 1
    from public.student_attempts sa
    join public.question_sets qs on qs.id = sa.question_set_id
    where sa.id = student_answers.attempt_id and qs.teacher_id = auth.uid()
  )
);

drop policy if exists "client inserts answer for own attempt" on public.student_answers;
create policy "client inserts answer for own attempt" on public.student_answers
for insert to anon
with check (
  public.student_answer_insert_is_valid(attempt_id, student_id, question_id)
);

create policy "teacher manages progress for own classes" on public.student_progress
for all using (
  exists (
    select 1
    from public.question_sets qs
    where qs.id = student_progress.question_set_id and qs.teacher_id = auth.uid()
  )
) with check (
  exists (
    select 1
    from public.question_sets qs
    where qs.id = student_progress.question_set_id and qs.teacher_id = auth.uid()
  )
);

drop policy if exists "client inserts progress when enrolled" on public.student_progress;
create policy "client inserts progress when enrolled" on public.student_progress
for insert to anon
with check (public.student_can_use_question_set(student_id, question_set_id));

drop policy if exists "client updates progress when enrolled" on public.student_progress;
create policy "client updates progress when enrolled" on public.student_progress
for update to anon
using (public.student_can_use_question_set(student_id, question_set_id))
with check (public.student_can_use_question_set(student_id, question_set_id));

-- Game clients (e.g. Unity) should use the Supabase anon key: policies above are TO anon only,
-- so authenticated teacher sessions are unchanged and other teachers' sets stay private.

grant select on public.question_sets to anon;
grant select on public.questions to anon;
grant insert, update on public.student_attempts to anon;
grant insert on public.student_answers to anon;
grant insert, update on public.student_progress to anon;

-- ---------------------------------------------------------------------------
-- Platform admin: full access to all rows (set profiles.role = 'admin' for that user).
-- Teachers remain scoped by teacher_id / enrollment; anon gameplay policies unchanged.
-- ---------------------------------------------------------------------------

drop policy if exists "admin full access profiles" on public.profiles;
create policy "admin full access profiles" on public.profiles
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admin full access classes" on public.classes;
create policy "admin full access classes" on public.classes
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admin full access students" on public.students;
create policy "admin full access students" on public.students
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admin full access class_students" on public.class_students;
create policy "admin full access class_students" on public.class_students
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admin full access class_join_requests" on public.class_join_requests;
create policy "admin full access class_join_requests" on public.class_join_requests
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admin full access question_sets" on public.question_sets;
create policy "admin full access question_sets" on public.question_sets
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admin full access questions" on public.questions;
create policy "admin full access questions" on public.questions
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admin full access student_attempts" on public.student_attempts;
create policy "admin full access student_attempts" on public.student_attempts
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admin full access student_answers" on public.student_answers;
create policy "admin full access student_answers" on public.student_answers
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admin full access student_progress" on public.student_progress;
create policy "admin full access student_progress" on public.student_progress
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Leaderboard: difficulty-weighted points on correct answers + views.
-- final_points = base_points × multiplier (multiplier = difficulty_level 1–5).
-- period_type: trigger sets 'answer'; default 'weekly' applies only when inserting without it.
-- INSERT is open to anon/authenticated; SELECT is limited to the class teacher via RLS.
-- ---------------------------------------------------------------------------

create table if not exists public.leaderboard_points (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  question_set_id uuid not null references public.question_sets (id) on delete cascade,
  difficulty_level integer not null check (difficulty_level between 1 and 5),
  base_points integer not null check (base_points >= 0),
  multiplier integer not null check (multiplier between 1 and 5),
  final_points integer not null check (final_points >= 0),
  period_type text not null default 'weekly',
  created_at timestamp with time zone default now()
);

create index if not exists leaderboard_points_created_at_idx on public.leaderboard_points (created_at desc);
create index if not exists leaderboard_points_student_class_idx on public.leaderboard_points (student_id, class_id);
create index if not exists leaderboard_points_class_created_idx on public.leaderboard_points (class_id, created_at desc);

alter table public.leaderboard_points enable row level security;

drop policy if exists "leaderboard_points_select_public" on public.leaderboard_points;
drop policy if exists "teacher reads leaderboard_points in own classes" on public.leaderboard_points;
drop policy if exists "leaderboard_points_insert_public" on public.leaderboard_points;

-- Teachers see points only for classes they own (dashboard + leaderboard views).
create policy "teacher reads leaderboard_points in own classes" on public.leaderboard_points
for select using (
  exists (
    select 1
    from public.classes c
    where c.id = leaderboard_points.class_id
      and c.teacher_id = auth.uid()
  )
);

create policy "leaderboard_points_insert_public" on public.leaderboard_points
for insert with check (true);

drop policy if exists "admin full access leaderboard_points" on public.leaderboard_points;
create policy "admin full access leaderboard_points" on public.leaderboard_points
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select, insert on public.leaderboard_points to anon, authenticated;

create or replace function public.record_leaderboard_points_from_answer()
returns trigger
language plpgsql
security definer
set search_path = public as $$
declare
  v_diff integer;
  v_base integer;
  v_qset uuid;
  v_class uuid;
  v_mult integer;
begin
  if not new.is_correct then
    return new;
  end if;

  select q.difficulty_level, coalesce(q.points, 10), q.question_set_id
  into v_diff, v_base, v_qset
  from public.questions q
  where q.id = new.question_id;

  if v_qset is null then
    return new;
  end if;

  select qs.class_id into v_class
  from public.question_sets qs
  where qs.id = v_qset;

  if v_class is null then
    return new;
  end if;

  v_diff := greatest(1, least(5, coalesce(v_diff, 1)));
  v_mult := v_diff;
  v_base := greatest(0, coalesce(v_base, 10));

  insert into public.leaderboard_points (
    student_id,
    class_id,
    question_set_id,
    difficulty_level,
    base_points,
    multiplier,
    final_points,
    period_type
  ) values (
    new.student_id,
    v_class,
    v_qset,
    v_diff,
    v_base,
    v_mult,
    v_base * v_mult,
    'answer'
  );

  return new;
end;
$$;

drop trigger if exists student_answers_leaderboard_points on public.student_answers;
create trigger student_answers_leaderboard_points
after insert on public.student_answers
for each row execute function public.record_leaderboard_points_from_answer();

-- Leaderboard views: same column layout for student rows and class rows (class rows use
-- null student_id and student_name = class_name) for unified clients. term_class_leaderboard
-- uses the same rolling window as term_student_leaderboard (~4 months).

create or replace view public.weekly_student_leaderboard as
with agg as (
  select
    lp.student_id,
    s.full_name as student_name,
    lp.class_id,
    c.class_name,
    sum(lp.final_points)::bigint as total_points
  from public.leaderboard_points lp
  join public.students s on s.id = lp.student_id
  join public.classes c on c.id = lp.class_id
  where lp.created_at >= date_trunc('week', now())
  group by lp.student_id, s.full_name, lp.class_id, c.class_name
)
select
  student_id,
  student_name,
  class_id,
  class_name,
  total_points,
  rank() over (partition by class_id order by total_points desc) as rank,
  rank() over (order by total_points desc) as overall_rank
from agg;

create or replace view public.monthly_student_leaderboard as
with agg as (
  select
    lp.student_id,
    s.full_name as student_name,
    lp.class_id,
    c.class_name,
    sum(lp.final_points)::bigint as total_points
  from public.leaderboard_points lp
  join public.students s on s.id = lp.student_id
  join public.classes c on c.id = lp.class_id
  where lp.created_at >= date_trunc('month', now())
  group by lp.student_id, s.full_name, lp.class_id, c.class_name
)
select
  student_id,
  student_name,
  class_id,
  class_name,
  total_points,
  rank() over (partition by class_id order by total_points desc) as rank,
  rank() over (order by total_points desc) as overall_rank
from agg;

create or replace view public.term_student_leaderboard as
with agg as (
  select
    lp.student_id,
    s.full_name as student_name,
    lp.class_id,
    c.class_name,
    sum(lp.final_points)::bigint as total_points
  from public.leaderboard_points lp
  join public.students s on s.id = lp.student_id
  join public.classes c on c.id = lp.class_id
  where lp.created_at >= (now() - interval '4 months')
  group by lp.student_id, s.full_name, lp.class_id, c.class_name
)
select
  student_id,
  student_name,
  class_id,
  class_name,
  total_points,
  rank() over (partition by class_id order by total_points desc) as rank,
  rank() over (order by total_points desc) as overall_rank
from agg;

create or replace view public.weekly_class_leaderboard as
with agg as (
  select
    lp.class_id,
    c.class_name,
    sum(lp.final_points)::bigint as total_points
  from public.leaderboard_points lp
  join public.classes c on c.id = lp.class_id
  where lp.created_at >= date_trunc('week', now())
  group by lp.class_id, c.class_name
)
select
  null::uuid as student_id,
  class_name as student_name,
  class_id,
  class_name,
  total_points,
  rank() over (order by total_points desc) as rank,
  rank() over (order by total_points desc) as overall_rank
from agg;

create or replace view public.monthly_class_leaderboard as
with agg as (
  select
    lp.class_id,
    c.class_name,
    sum(lp.final_points)::bigint as total_points
  from public.leaderboard_points lp
  join public.classes c on c.id = lp.class_id
  where lp.created_at >= date_trunc('month', now())
  group by lp.class_id, c.class_name
)
select
  null::uuid as student_id,
  class_name as student_name,
  class_id,
  class_name,
  total_points,
  rank() over (order by total_points desc) as rank,
  rank() over (order by total_points desc) as overall_rank
from agg;

create or replace view public.term_class_leaderboard as
with agg as (
  select
    lp.class_id,
    c.class_name,
    sum(lp.final_points)::bigint as total_points
  from public.leaderboard_points lp
  join public.classes c on c.id = lp.class_id
  where lp.created_at >= (now() - interval '4 months')
  group by lp.class_id, c.class_name
)
select
  null::uuid as student_id,
  class_name as student_name,
  class_id,
  class_name,
  total_points,
  rank() over (order by total_points desc) as rank,
  rank() over (order by total_points desc) as overall_rank
from agg;

grant select on public.weekly_student_leaderboard to anon, authenticated;
grant select on public.monthly_student_leaderboard to anon, authenticated;
grant select on public.term_student_leaderboard to anon, authenticated;
grant select on public.weekly_class_leaderboard to anon, authenticated;
grant select on public.monthly_class_leaderboard to anon, authenticated;
grant select on public.term_class_leaderboard to anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'teacher'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Ensures profiles row (fixes classes.teacher_id → profiles FK on first login if trigger missed).
-- Adds one starter class when the teacher has never had any class row (including archived).
create or replace function public.bootstrap_teacher_workspace()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  meta jsonb;
  em text;
  v_teacher_name text;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (select 1 from public.profiles p where p.id = uid) then
    select u.raw_user_meta_data, u.email into meta, em
    from auth.users u
    where u.id = uid;
    if not found then
      raise exception 'Auth user missing';
    end if;
    insert into public.profiles (id, full_name, role)
    values (
      uid,
      coalesce(
        nullif(trim(meta->>'full_name'), ''),
        nullif(trim(split_part(em, '@', 1)), ''),
        'Teacher'
      ),
      'teacher'
    )
    on conflict (id) do nothing;
  end if;

  select coalesce(nullif(trim(p.full_name), ''), 'Your teacher') into v_teacher_name
  from public.profiles p
  where p.id = uid;

  insert into public.classes (teacher_id, class_name, description)
  select
    uid,
    'My class',
    'Teacher: ' || v_teacher_name || E'.\n\nYou can rename this class and edit this text under Classes.'
  where not exists (select 1 from public.classes c where c.teacher_id = uid);
end;
$$;

revoke all on function public.bootstrap_teacher_workspace() from public;
grant execute on function public.bootstrap_teacher_workspace() to authenticated;

create or replace function public.submit_class_join_request(
  p_invite_code text,
  p_full_name text,
  p_username text
)
returns uuid
language plpgsql
security definer
set search_path = public as $$
declare
  v_class_id uuid;
  v_username text;
  v_req_id uuid;
begin
  v_username := lower(trim(p_username));
  if length(v_username) < 2 then
    raise exception 'Invalid username';
  end if;

  select id into v_class_id
  from public.classes
  where invite_code is not null
    and archived_at is null
    and upper(trim(invite_code)) = upper(trim(p_invite_code));

  if v_class_id is null then
    raise exception 'Invalid or inactive join code';
  end if;

  if exists (
    select 1 from public.class_join_requests r
    where r.class_id = v_class_id
      and lower(r.username) = v_username
      and r.status = 'pending'
  ) then
    raise exception 'Join request already pending';
  end if;

  if exists (
    select 1
    from public.class_students cs
    join public.students s on s.id = cs.student_id
    where cs.class_id = v_class_id and lower(s.username) = v_username
  ) then
    raise exception 'Already enrolled in this class';
  end if;

  insert into public.class_join_requests (class_id, full_name, username, status)
  values (v_class_id, trim(p_full_name), v_username, 'pending')
  returning id into v_req_id;

  return v_req_id;
end;
$$;

create or replace function public.approve_class_join_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public as $$
declare
  v_class_id uuid;
  v_full_name text;
  v_username text;
  v_status text;
  v_teacher_id uuid;
  v_student_id uuid;
begin
  select cjr.class_id, cjr.full_name, cjr.username, cjr.status, c.teacher_id
  into v_class_id, v_full_name, v_username, v_status, v_teacher_id
  from public.class_join_requests cjr
  join public.classes c on c.id = cjr.class_id
  where cjr.id = p_request_id
  for update of cjr;

  if not found then
    raise exception 'Request not found';
  end if;

  if v_teacher_id is distinct from auth.uid()
     and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') then
    raise exception 'Not authorized';
  end if;

  if v_status <> 'pending' then
    raise exception 'Request is not pending';
  end if;

  select id into v_student_id from public.students where lower(username) = lower(v_username);

  if v_student_id is null then
    insert into public.students (full_name, username, class_level, archived_at, created_by_teacher_id)
    values (v_full_name, v_username, null, null, v_teacher_id)
    returning id into v_student_id;
  else
    update public.students set full_name = v_full_name where id = v_student_id;
  end if;

  insert into public.class_students (class_id, student_id)
  values (v_class_id, v_student_id)
  on conflict (class_id, student_id) do nothing;

  update public.class_join_requests set status = 'approved' where id = p_request_id;
end;
$$;

create or replace function public.reject_class_join_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public as $$
declare
  v_teacher_id uuid;
  v_status text;
begin
  select c.teacher_id, cjr.status
  into v_teacher_id, v_status
  from public.class_join_requests cjr
  join public.classes c on c.id = cjr.class_id
  where cjr.id = p_request_id
  for update of cjr;

  if not found then
    raise exception 'Request not found';
  end if;

  if v_teacher_id is distinct from auth.uid()
     and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') then
    raise exception 'Not authorized';
  end if;

  if v_status <> 'pending' then
    raise exception 'Request is not pending';
  end if;

  update public.class_join_requests set status = 'rejected' where id = p_request_id;
end;
$$;

create or replace function public.create_student_for_class(
  p_class_id uuid,
  p_full_name text,
  p_username text,
  p_class_level text default null
)
returns uuid
language plpgsql
security definer
set search_path = public as $$
declare
  v_student_id uuid;
  v_username text;
  v_level text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.classes c
    where c.id = p_class_id
      and c.archived_at is null
      and (
        c.teacher_id = auth.uid()
        or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
      )
  ) then
    raise exception 'Class not found or access denied';
  end if;

  if length(trim(coalesce(p_full_name, ''))) < 1 then
    raise exception 'Full name is required';
  end if;

  v_username := lower(trim(p_username));
  if length(v_username) < 2 then
    raise exception 'Username must be at least 2 characters';
  end if;

  v_level := nullif(trim(coalesce(p_class_level, '')), '');

  insert into public.students (full_name, username, class_level, archived_at, created_by_teacher_id)
  values (trim(p_full_name), v_username, v_level, null, auth.uid())
  returning id into v_student_id;

  insert into public.class_students (class_id, student_id)
  values (p_class_id, v_student_id);

  return v_student_id;
exception
  when unique_violation then
    raise exception 'That username is already in use';
end;
$$;

grant execute on function public.submit_class_join_request(text, text, text) to anon, authenticated;
grant execute on function public.approve_class_join_request(uuid) to authenticated;
grant execute on function public.reject_class_join_request(uuid) to authenticated;
grant execute on function public.create_student_for_class(uuid, text, text, text) to authenticated;

create or replace view public.class_dashboard_row as
select
  c.id,
  c.teacher_id,
  c.class_name,
  c.description,
  c.invite_code,
  c.created_at,
  c.archived_at,
  (
    select count(*)::int
    from public.class_students cs
    join public.students st on st.id = cs.student_id
    where cs.class_id = c.id and st.archived_at is null
  ) as student_count,
  (select count(*)::int from public.question_sets qs where qs.class_id = c.id) as question_set_count,
  (select count(*)::int from public.class_join_requests r where r.class_id = c.id and r.status = 'pending') as pending_join_count,
  coalesce(
    (select round(avg(sa.percentage)::numeric, 2)
     from public.student_attempts sa
     join public.question_sets qs on qs.id = sa.question_set_id
     where qs.class_id = c.id),
    0
  ) as avg_score_pct,
  (select max(sa.completed_at)
   from public.student_attempts sa
   join public.question_sets qs on qs.id = sa.question_set_id
   where qs.class_id = c.id) as last_activity_at,
  (select count(*)::int
   from public.student_attempts sa
   join public.question_sets qs on qs.id = sa.question_set_id
   where qs.class_id = c.id) as attempt_count,
  (select count(*)::int
   from public.student_attempts sa
   join public.question_sets qs on qs.id = sa.question_set_id
   where qs.class_id = c.id and sa.passed = true) as passed_attempt_count
from public.classes c;

create or replace view public.class_performance_view as
select
  c.id as class_id,
  c.class_name,
  s.full_name as student_name,
  qs.id as question_set_id,
  qs.title as question_set_title,
  round(avg(sa.percentage), 2) as average_percentage,
  count(sa.id) as total_attempts,
  count(sa.id) filter (where sa.passed = true) as passed_attempts
from public.student_attempts sa
join public.students s on s.id = sa.student_id
join public.question_sets qs on qs.id = sa.question_set_id
join public.classes c on c.id = qs.class_id
group by c.id, c.class_name, s.full_name, qs.id, qs.title;

create or replace view public.weak_topics_view as
select
  qs.class_id,
  s.id as student_id,
  qs.topic,
  s.full_name as student_name,
  round(avg(sa.percentage), 2) as average_score,
  sum(
    (
      select count(*)::bigint
      from public.student_answers sa2
      where sa2.attempt_id = sa.id and sa2.is_correct = false
    )
  ) as wrong_answers_count
from public.student_attempts sa
join public.students s on s.id = sa.student_id
join public.question_sets qs on qs.id = sa.question_set_id
group by qs.class_id, s.id, qs.topic, s.full_name;

create or replace view public.student_teacher_metrics as
select
  s.id as student_id,
  s.full_name,
  s.username,
  s.class_level,
  s.created_at,
  s.archived_at,
  (select count(distinct cs.class_id)::int
   from public.class_students cs
   join public.classes c on c.id = cs.class_id and c.teacher_id = auth.uid()
   where cs.student_id = s.id) as class_count,
  (select max(sa.completed_at)
   from public.student_attempts sa
   join public.question_sets qs on qs.id = sa.question_set_id
   join public.classes c on c.id = qs.class_id and c.teacher_id = auth.uid()
   where sa.student_id = s.id) as last_activity_at,
  (select count(*)::int
   from public.student_attempts sa
   join public.question_sets qs on qs.id = sa.question_set_id
   join public.classes c on c.id = qs.class_id and c.teacher_id = auth.uid()
   where sa.student_id = s.id) as attempt_count,
  coalesce(
    (select round(avg(sa.percentage)::numeric, 2)
     from public.student_attempts sa
     join public.question_sets qs on qs.id = sa.question_set_id
     join public.classes c on c.id = qs.class_id and c.teacher_id = auth.uid()
     where sa.student_id = s.id),
    0
  ) as avg_pct,
  (select count(*) filter (where sa.passed)::int
   from public.student_attempts sa
   join public.question_sets qs on qs.id = sa.question_set_id
   join public.classes c on c.id = qs.class_id and c.teacher_id = auth.uid()
   where sa.student_id = s.id) as passed_count
from public.students s
where s.created_by_teacher_id = auth.uid()
   or exists (
    select 1
    from public.class_students cs
    join public.classes c on c.id = cs.class_id and c.teacher_id = auth.uid()
    where cs.student_id = s.id
  );