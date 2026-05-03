-- Run once if your database predates student archive, student_teacher_metrics, weak_topics student_id, or teacher delete on students.
-- Safe to re-run: IF NOT EXISTS / OR REPLACE / DROP POLICY IF EXISTS where applicable.

alter table public.students add column if not exists archived_at timestamp with time zone;

drop policy if exists "teacher deletes students in own classes" on public.students;
create policy "teacher deletes students in own classes" on public.students
for delete using (
  exists (
    select 1
    from public.class_students cs
    join public.classes c on c.id = cs.class_id
    where cs.student_id = students.id and c.teacher_id = auth.uid()
  )
);

create or replace view public.weak_topics_view as
select
  qs.class_id,
  s.id as student_id,
  qs.topic,
  s.full_name as student_name,
  round(avg(sa.percentage), 2) as average_score,
  count(sa2.id) filter (where sa2.is_correct = false) as wrong_answers_count
from public.student_attempts sa
join public.students s on s.id = sa.student_id
join public.question_sets qs on qs.id = sa.question_set_id
left join public.student_answers sa2 on sa2.attempt_id = sa.id
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
where exists (
  select 1
  from public.class_students cs
  join public.classes c on c.id = cs.class_id and c.teacher_id = auth.uid()
  where cs.student_id = s.id
);

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
