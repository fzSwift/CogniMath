-- Only the teacher who owns the class (classes.teacher_id) may access question sets and
-- related attempts/answers/progress for that class — not merely question_sets.teacher_id.
-- Safe to re-run.

drop policy if exists "teacher manages own question sets" on public.question_sets;
drop policy if exists "teacher manages question sets in own classes" on public.question_sets;

create policy "teacher manages question sets in own classes" on public.question_sets
for all using (
  exists (
    select 1 from public.classes c
    where c.id = question_sets.class_id
      and c.teacher_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.classes c
    where c.id = question_sets.class_id
      and c.teacher_id = auth.uid()
  )
  and teacher_id = auth.uid()
);

drop policy if exists "teacher manages questions from own sets" on public.questions;
create policy "teacher manages questions from own sets" on public.questions
for all using (
  exists (
    select 1
    from public.question_sets qs
    join public.classes c on c.id = qs.class_id
    where qs.id = questions.question_set_id
      and c.teacher_id = auth.uid()
  )
) with check (
  exists (
    select 1
    from public.question_sets qs
    join public.classes c on c.id = qs.class_id
    where qs.id = questions.question_set_id
      and c.teacher_id = auth.uid()
  )
);

drop policy if exists "teacher reads attempts for own classes" on public.student_attempts;
create policy "teacher reads attempts for own classes" on public.student_attempts
for select using (
  exists (
    select 1
    from public.question_sets qs
    join public.classes c on c.id = qs.class_id
    where qs.id = student_attempts.question_set_id
      and c.teacher_id = auth.uid()
  )
);

drop policy if exists "teacher manages attempts for own classes" on public.student_attempts;
create policy "teacher manages attempts for own classes" on public.student_attempts
for all using (
  exists (
    select 1
    from public.question_sets qs
    join public.classes c on c.id = qs.class_id
    where qs.id = student_attempts.question_set_id
      and c.teacher_id = auth.uid()
  )
) with check (
  exists (
    select 1
    from public.question_sets qs
    join public.classes c on c.id = qs.class_id
    where qs.id = student_attempts.question_set_id
      and c.teacher_id = auth.uid()
  )
);

drop policy if exists "teacher reads answers for own classes" on public.student_answers;
create policy "teacher reads answers for own classes" on public.student_answers
for select using (
  exists (
    select 1
    from public.student_attempts sa
    join public.question_sets qs on qs.id = sa.question_set_id
    join public.classes c on c.id = qs.class_id
    where sa.id = student_answers.attempt_id
      and c.teacher_id = auth.uid()
  )
);

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

drop policy if exists "teacher manages progress for own classes" on public.student_progress;
create policy "teacher manages progress for own classes" on public.student_progress
for all using (
  exists (
    select 1
    from public.question_sets qs
    join public.classes c on c.id = qs.class_id
    where qs.id = student_progress.question_set_id
      and c.teacher_id = auth.uid()
  )
) with check (
  exists (
    select 1
    from public.question_sets qs
    join public.classes c on c.id = qs.class_id
    where qs.id = student_progress.question_set_id
      and c.teacher_id = auth.uid()
  )
);
