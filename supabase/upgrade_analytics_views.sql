-- Adds question_set_id to class_performance_view for analytics deep links + CSV.
-- Safe to re-run.

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
