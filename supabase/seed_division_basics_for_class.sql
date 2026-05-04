-- Replace UUIDs, then run in Supabase SQL Editor (postgres bypasses RLS).
do $$
declare
  v_teacher_id uuid := 'PASTE_TEACHER_PROFILE_ID_HERE';
  v_class_id uuid := 'PASTE_CLASS_ID_HERE';
  v_division_set uuid;
begin
  delete from public.question_sets
  where class_id = v_class_id
    and title = 'Division Basics';

  insert into public.question_sets (teacher_id, class_id, title, topic, description, threshold_score, is_active)
  values (v_teacher_id, v_class_id, 'Division Basics', 'Division', 'Division questions from Level 1 to Level 5.', 70, true)
  returning id into v_division_set;

  insert into public.questions
  (question_set_id, question_text, option_a, option_b, option_c, option_d, correct_answer, difficulty_level, sequence_order, points)
  values
  (v_division_set, '4 ÷ 2 = ?', '1', '2', '3', '4', 'B', 1, 1, 10),
  (v_division_set, '6 ÷ 2 = ?', '2', '3', '4', '5', 'B', 1, 2, 10),
  (v_division_set, '8 ÷ 2 = ?', '3', '4', '5', '6', 'B', 1, 3, 10),
  (v_division_set, '10 ÷ 2 = ?', '4', '5', '6', '7', 'B', 1, 4, 10),
  (v_division_set, '12 ÷ 3 = ?', '3', '4', '5', '6', 'B', 1, 5, 10),
  (v_division_set, '15 ÷ 3 = ?', '4', '5', '6', '7', 'B', 1, 6, 10),
  (v_division_set, '16 ÷ 4 = ?', '3', '4', '5', '6', 'B', 1, 7, 10),
  (v_division_set, '18 ÷ 3 = ?', '5', '6', '7', '8', 'B', 1, 8, 10),
  (v_division_set, '20 ÷ 4 = ?', '4', '5', '6', '7', 'B', 1, 9, 10),
  (v_division_set, '21 ÷ 3 = ?', '6', '7', '8', '9', 'B', 1, 10, 10),
  (v_division_set, '24 ÷ 6 = ?', '3', '4', '5', '6', 'B', 2, 1, 15),
  (v_division_set, '30 ÷ 5 = ?', '4', '5', '6', '7', 'C', 2, 2, 15),
  (v_division_set, '36 ÷ 6 = ?', '5', '6', '7', '8', 'B', 2, 3, 15),
  (v_division_set, '42 ÷ 7 = ?', '5', '6', '7', '8', 'B', 2, 4, 15),
  (v_division_set, '48 ÷ 8 = ?', '5', '6', '7', '8', 'B', 2, 5, 15),
  (v_division_set, '54 ÷ 9 = ?', '5', '6', '7', '8', 'B', 2, 6, 15),
  (v_division_set, '63 ÷ 7 = ?', '7', '8', '9', '10', 'C', 2, 7, 15),
  (v_division_set, '72 ÷ 8 = ?', '7', '8', '9', '10', 'C', 2, 8, 15),
  (v_division_set, '81 ÷ 9 = ?', '7', '8', '9', '10', 'C', 2, 9, 15),
  (v_division_set, '100 ÷ 10 = ?', '8', '9', '10', '11', 'C', 2, 10, 15),
  (v_division_set, '120 ÷ 12 = ?', '8', '9', '10', '11', 'C', 3, 1, 20),
  (v_division_set, '144 ÷ 12 = ?', '10', '11', '12', '13', 'C', 3, 2, 20),
  (v_division_set, '150 ÷ 15 = ?', '8', '9', '10', '11', 'C', 3, 3, 20),
  (v_division_set, '168 ÷ 14 = ?', '10', '11', '12', '13', 'C', 3, 4, 20),
  (v_division_set, '180 ÷ 15 = ?', '10', '11', '12', '13', 'C', 3, 5, 20),
  (v_division_set, '196 ÷ 14 = ?', '12', '13', '14', '15', 'C', 3, 6, 20),
  (v_division_set, '225 ÷ 15 = ?', '13', '14', '15', '16', 'C', 3, 7, 20),
  (v_division_set, '240 ÷ 16 = ?', '13', '14', '15', '16', 'C', 3, 8, 20),
  (v_division_set, '270 ÷ 18 = ?', '13', '14', '15', '16', 'C', 3, 9, 20),
  (v_division_set, '300 ÷ 20 = ?', '13', '14', '15', '16', 'C', 3, 10, 20),
  (v_division_set, '1,000 ÷ 25 = ?', '30', '35', '40', '45', 'C', 4, 1, 25),
  (v_division_set, '1,200 ÷ 30 = ?', '30', '35', '40', '45', 'C', 4, 2, 25),
  (v_division_set, '1,500 ÷ 50 = ?', '20', '25', '30', '35', 'C', 4, 3, 25),
  (v_division_set, '2,400 ÷ 60 = ?', '30', '35', '40', '45', 'C', 4, 4, 25),
  (v_division_set, '3,600 ÷ 90 = ?', '30', '35', '40', '45', 'C', 4, 5, 25),
  (v_division_set, '4,800 ÷ 120 = ?', '30', '35', '40', '45', 'C', 4, 6, 25),
  (v_division_set, '5,000 ÷ 125 = ?', '30', '35', '40', '45', 'C', 4, 7, 25),
  (v_division_set, '6,400 ÷ 160 = ?', '30', '35', '40', '45', 'C', 4, 8, 25),
  (v_division_set, '7,200 ÷ 180 = ?', '30', '35', '40', '45', 'C', 4, 9, 25),
  (v_division_set, '9,000 ÷ 300 = ?', '20', '25', '30', '35', 'C', 4, 10, 25),
  (v_division_set, '20 apples are shared equally among 4 children. How many each?', '4', '5', '6', '7', 'B', 5, 1, 30),
  (v_division_set, '36 pencils are shared among 6 students. How many each?', '5', '6', '7', '8', 'B', 5, 2, 30),
  (v_division_set, '48 books are placed equally on 8 shelves. How many per shelf?', '5', '6', '7', '8', 'B', 5, 3, 30),
  (v_division_set, '72 students are divided into 9 groups. How many in each group?', '6', '7', '8', '9', 'C', 5, 4, 30),
  (v_division_set, '100 cedis is shared by 5 children. How much does each get?', '10', '15', '20', '25', 'C', 5, 5, 30),
  (v_division_set, '120 oranges are packed into 10 boxes. How many per box?', '10', '11', '12', '13', 'C', 5, 6, 30),
  (v_division_set, '150 points are shared equally across 6 levels. Points per level?', '20', '25', '30', '35', 'B', 5, 7, 30),
  (v_division_set, '240 students are placed into 12 classes. Students per class?', '15', '20', '25', '30', 'B', 5, 8, 30),
  (v_division_set, '300 books are divided among 15 shelves. Books per shelf?', '15', '20', '25', '30', 'B', 5, 9, 30),
  (v_division_set, '500 points are shared equally among 20 students. How many points each?', '20', '25', '30', '35', 'B', 5, 10, 30);
end $$;
