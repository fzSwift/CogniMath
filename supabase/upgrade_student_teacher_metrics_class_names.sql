-- Adds enrolled_class_names to student_teacher_metrics (comma-separated class names for your rosters).
-- Column is appended last so CREATE OR REPLACE VIEW succeeds (PG cannot insert columns mid-list).
-- Safe to re-run.

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
