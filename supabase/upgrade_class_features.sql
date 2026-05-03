-- Run once if your database was created before class archive + dashboard view + analytics view columns.
-- Safe to re-run: uses IF NOT EXISTS / OR REPLACE where applicable.

alter table public.classes add column if not exists archived_at timestamp with time zone;

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

create or replace view public.class_dashboard_row as
select
  c.id,
  c.teacher_id,
  c.class_name,
  c.description,
  c.invite_code,
  c.created_at,
  c.archived_at,
  (select count(*)::int from public.class_students cs where cs.class_id = c.id) as student_count,
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
  qs.title as question_set_title,
  round(avg(sa.percentage), 2) as average_percentage,
  count(sa.id) as total_attempts,
  count(sa.id) filter (where sa.passed = true) as passed_attempts
from public.student_attempts sa
join public.students s on s.id = sa.student_id
join public.question_sets qs on qs.id = sa.question_set_id
join public.classes c on c.id = qs.class_id
group by c.id, c.class_name, s.full_name, qs.title;

create or replace view public.weak_topics_view as
select
  qs.class_id,
  qs.topic,
  s.full_name as student_name,
  round(avg(sa.percentage), 2) as average_score,
  count(sa2.id) filter (where sa2.is_correct = false) as wrong_answers_count
from public.student_attempts sa
join public.students s on s.id = sa.student_id
join public.question_sets qs on qs.id = sa.question_set_id
left join public.student_answers sa2 on sa2.attempt_id = sa.id
group by qs.class_id, qs.topic, s.full_name;
