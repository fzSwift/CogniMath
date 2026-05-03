do $$
declare
  teacher_uuid uuid;
  class_a uuid;
  class_b uuid;
  student_1 uuid;
  student_2 uuid;
  student_3 uuid;
  set_1 uuid;
  set_2 uuid;
  q1 uuid;
  q2 uuid;
  q3 uuid;
  attempt_1 uuid;
begin
  select id into teacher_uuid from public.profiles limit 1;

  if teacher_uuid is null then
    raise exception 'No teacher profile found. Create a teacher account first.';
  end if;

  insert into public.classes (teacher_id, class_name, description)
  values
    (teacher_uuid, 'JSS 1A', 'Foundational algebra class'),
    (teacher_uuid, 'JSS 1B', 'Mixed ability algebra class')
  returning id into class_a;

  select id into class_b from public.classes where class_name = 'JSS 1B' and teacher_id = teacher_uuid limit 1;

  insert into public.students (full_name, username, class_level)
  values
    ('Amina Yusuf', 'amina01', 'JSS 1'),
    ('Daniel Okoro', 'daniel02', 'JSS 1'),
    ('Grace Bello', 'grace03', 'JSS 1')
  returning id into student_1;

  select id into student_2 from public.students where username = 'daniel02' limit 1;
  select id into student_3 from public.students where username = 'grace03' limit 1;

  insert into public.class_students (class_id, student_id)
  values
    (class_a, student_1),
    (class_a, student_2),
    (class_b, student_3)
  on conflict (class_id, student_id) do nothing;

  insert into public.question_sets (teacher_id, class_id, title, topic, description, threshold_score)
  values
    (teacher_uuid, class_a, 'Linear Expressions Basics', 'Linear Expressions', 'Introduction to algebraic expressions', 70),
    (teacher_uuid, class_b, 'One-Step Equations', 'Solving Equations', 'Practice balancing equations', 70)
  returning id into set_1;

  select id into set_2 from public.question_sets where title = 'One-Step Equations' and teacher_id = teacher_uuid limit 1;

  insert into public.questions (question_set_id, question_text, option_a, option_b, option_c, option_d, correct_answer, difficulty_level, sequence_order, points)
  values
    (set_1, 'Simplify: 2x + 3x', '5x', '6x', 'x', '2x^2', 'A', 1, 1, 10),
    (set_1, 'What is the coefficient of x in 7x + 4?', '4', '7', '11', 'x', 'B', 1, 2, 10),
    (set_1, 'If x = 3, evaluate 2x + 5', '11', '10', '9', '8', 'A', 2, 3, 15)
  returning id into q1;

  select id into q2 from public.questions where question_text = 'What is the coefficient of x in 7x + 4?' and question_set_id = set_1 limit 1;
  select id into q3 from public.questions where question_text = 'If x = 3, evaluate 2x + 5' and question_set_id = set_1 limit 1;

  insert into public.student_attempts (student_id, question_set_id, difficulty_level, score, total_questions, percentage, passed)
  values
    (student_1, set_1, 2, 25, 3, 83.33, true),
    (student_2, set_1, 2, 15, 3, 50.00, false)
  returning id into attempt_1;

  insert into public.student_answers (attempt_id, student_id, question_id, selected_answer, correct_answer, is_correct)
  values
    (attempt_1, student_1, q1, 'A', 'A', true),
    (attempt_1, student_1, q2, 'B', 'B', true),
    (attempt_1, student_1, q3, 'C', 'A', false);

  insert into public.student_progress (student_id, question_set_id, current_difficulty_level, total_points, highest_score)
  values
    (student_1, set_1, 2, 25, 83.33),
    (student_2, set_1, 1, 15, 50.00),
    (student_3, set_2, 1, 0, 0)
  on conflict (student_id, question_set_id) do update
  set current_difficulty_level = excluded.current_difficulty_level,
      total_points = excluded.total_points,
      highest_score = excluded.highest_score,
      updated_at = now();
end $$;
