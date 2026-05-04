-- Teacher isolation + platform admin: teachers see only their classes/data (plus students they created).
-- Admins (profiles.role = 'admin') bypass via separate RLS policies.
-- Safe to re-run (drops/recreates named policies + replaces functions/views).

alter table public.students add column if not exists created_by_teacher_id uuid references public.profiles (id) on delete set null;
create index if not exists students_created_by_teacher_idx on public.students (created_by_teacher_id)
  where created_by_teacher_id is not null;

-- Drop policies that reference is_teacher() before dropping the function.
drop policy if exists "teacher can create students" on public.students;

drop function if exists public.is_teacher();

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

create or replace function public.enforce_profile_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    if auth.uid() is not null then
      if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') then
        raise exception 'Only an admin may change profiles.role';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_role_guard on public.profiles;
create trigger profiles_role_guard
before update on public.profiles
for each row execute function public.enforce_profile_role_change();

drop policy if exists "teacher can read students in own classes" on public.students;
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

drop policy if exists "teacher can create students" on public.students;
create policy "teacher can create students" on public.students
for insert with check (public.is_teacher_account());

drop policy if exists "teacher can update students in own classes" on public.students;
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

drop policy if exists "teacher deletes students in own classes" on public.students;
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

drop policy if exists "admin full access leaderboard_points" on public.leaderboard_points;
create policy "admin full access leaderboard_points" on public.leaderboard_points
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

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
   where sa.student_id = s.id) as passed_count,
  (select string_agg(c2.class_name, ', ' order by c2.class_name)
   from public.class_students cs2
   join public.classes c2 on c2.id = cs2.class_id and c2.teacher_id = auth.uid()
   where cs2.student_id = s.id) as enrolled_class_names
from public.students s
where s.created_by_teacher_id = auth.uid()
   or exists (
    select 1
    from public.class_students cs
    join public.classes c on c.id = cs.class_id and c.teacher_id = auth.uid()
    where cs.student_id = s.id
  );

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
