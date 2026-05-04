-- If question-set delete fails under RLS, run this once in Supabase SQL Editor.

drop policy if exists "teacher deletes answers for own classes" on public.student_answers;

create policy "teacher deletes answers for own classes" on public.student_answers
for delete using (
  exists (
    select 1
    from public.student_attempts sa
    join public.question_sets qs on qs.id = sa.question_set_id
    join public.classes c on c.id = qs.class_id
    where sa.id = student_answers.attempt_id
      and c.teacher_id = auth.uid()
  )
);
