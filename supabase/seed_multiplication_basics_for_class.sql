-- Replace UUIDs, then run in Supabase SQL Editor (postgres bypasses RLS).
do $$
declare
  v_teacher_id uuid := 'PASTE_TEACHER_PROFILE_ID_HERE';
  v_class_id uuid := 'PASTE_CLASS_ID_HERE';
  v_multiplication_set uuid;
begin
  delete from public.question_sets
  where class_id = v_class_id
    and title = 'Multiplication Basics';

  insert into public.question_sets (teacher_id, class_id, title, topic, description, threshold_score, is_active)
  values (v_teacher_id, v_class_id, 'Multiplication Basics', 'Multiplication', 'Multiplication questions from Level 1 to Level 5.', 70, true)
  returning id into v_multiplication_set;

  insert into public.questions
  (question_set_id, question_text, option_a, option_b, option_c, option_d, correct_answer, difficulty_level, sequence_order, points)
  values
  (v_multiplication_set, '2 × 2 = ?', '2', '4', '6', '8', 'B', 1, 1, 10),
  (v_multiplication_set, '3 × 2 = ?', '4', '6', '8', '10', 'B', 1, 2, 10),
  (v_multiplication_set, '4 × 2 = ?', '6', '8', '10', '12', 'B', 1, 3, 10),
  (v_multiplication_set, '5 × 2 = ?', '8', '10', '12', '14', 'B', 1, 4, 10),
  (v_multiplication_set, '6 × 2 = ?', '10', '12', '14', '16', 'B', 1, 5, 10),
  (v_multiplication_set, '3 × 3 = ?', '6', '9', '12', '15', 'B', 1, 6, 10),
  (v_multiplication_set, '4 × 3 = ?', '9', '12', '15', '18', 'B', 1, 7, 10),
  (v_multiplication_set, '5 × 3 = ?', '12', '15', '18', '21', 'B', 1, 8, 10),
  (v_multiplication_set, '2 × 7 = ?', '12', '14', '16', '18', 'B', 1, 9, 10),
  (v_multiplication_set, '2 × 9 = ?', '16', '18', '20', '22', 'B', 1, 10, 10),
  (v_multiplication_set, '6 × 4 = ?', '20', '22', '24', '26', 'C', 2, 1, 15),
  (v_multiplication_set, '7 × 5 = ?', '30', '35', '40', '45', 'B', 2, 2, 15),
  (v_multiplication_set, '8 × 3 = ?', '21', '24', '27', '30', 'B', 2, 3, 15),
  (v_multiplication_set, '9 × 4 = ?', '32', '36', '40', '44', 'B', 2, 4, 15),
  (v_multiplication_set, '6 × 6 = ?', '30', '36', '42', '48', 'B', 2, 5, 15),
  (v_multiplication_set, '7 × 7 = ?', '42', '49', '56', '63', 'B', 2, 6, 15),
  (v_multiplication_set, '8 × 5 = ?', '35', '40', '45', '50', 'B', 2, 7, 15),
  (v_multiplication_set, '9 × 5 = ?', '40', '45', '50', '55', 'B', 2, 8, 15),
  (v_multiplication_set, '10 × 6 = ?', '50', '60', '70', '80', 'B', 2, 9, 15),
  (v_multiplication_set, '11 × 3 = ?', '30', '33', '36', '39', 'B', 2, 10, 15),
  (v_multiplication_set, '12 × 4 = ?', '44', '48', '52', '56', 'B', 3, 1, 20),
  (v_multiplication_set, '13 × 5 = ?', '55', '60', '65', '70', 'C', 3, 2, 20),
  (v_multiplication_set, '14 × 6 = ?', '78', '82', '84', '88', 'C', 3, 3, 20),
  (v_multiplication_set, '15 × 7 = ?', '95', '100', '105', '110', 'C', 3, 4, 20),
  (v_multiplication_set, '16 × 8 = ?', '118', '124', '128', '132', 'C', 3, 5, 20),
  (v_multiplication_set, '17 × 3 = ?', '48', '51', '54', '57', 'B', 3, 6, 20),
  (v_multiplication_set, '18 × 4 = ?', '68', '72', '76', '80', 'B', 3, 7, 20),
  (v_multiplication_set, '19 × 5 = ?', '85', '90', '95', '100', 'C', 3, 8, 20),
  (v_multiplication_set, '21 × 6 = ?', '116', '120', '126', '132', 'C', 3, 9, 20),
  (v_multiplication_set, '25 × 4 = ?', '90', '95', '100', '105', 'C', 3, 10, 20),
  (v_multiplication_set, '32 × 12 = ?', '364', '374', '384', '394', 'C', 4, 1, 25),
  (v_multiplication_set, '45 × 11 = ?', '485', '495', '505', '515', 'B', 4, 2, 25),
  (v_multiplication_set, '56 × 13 = ?', '718', '728', '738', '748', 'B', 4, 3, 25),
  (v_multiplication_set, '72 × 14 = ?', '998', '1008', '1018', '1028', 'B', 4, 4, 25),
  (v_multiplication_set, '81 × 15 = ?', '1205', '1215', '1225', '1235', 'B', 4, 5, 25),
  (v_multiplication_set, '64 × 16 = ?', '1014', '1024', '1034', '1044', 'B', 4, 6, 25),
  (v_multiplication_set, '95 × 12 = ?', '1120', '1130', '1140', '1150', 'C', 4, 7, 25),
  (v_multiplication_set, '125 × 8 = ?', '900', '950', '1000', '1050', 'C', 4, 8, 25),
  (v_multiplication_set, '144 × 6 = ?', '854', '864', '874', '884', 'B', 4, 9, 25),
  (v_multiplication_set, '250 × 4 = ?', '900', '950', '1000', '1050', 'C', 4, 10, 25),
  (v_multiplication_set, 'There are 5 bags with 6 oranges each. How many oranges?', '25', '30', '35', '40', 'B', 5, 1, 30),
  (v_multiplication_set, 'A class has 8 rows with 4 students each. How many students?', '28', '32', '36', '40', 'B', 5, 2, 30),
  (v_multiplication_set, 'A book has 12 pages in each chapter and 5 chapters. Total pages?', '50', '55', '60', '65', 'C', 5, 3, 30),
  (v_multiplication_set, 'A farmer has 9 baskets with 7 eggs each. How many eggs?', '56', '63', '70', '77', 'B', 5, 4, 30),
  (v_multiplication_set, 'A child earns 15 points in each of 6 rounds. Total points?', '80', '85', '90', '95', 'C', 5, 5, 30),
  (v_multiplication_set, 'There are 24 pencils in each box and 3 boxes. Total pencils?', '62', '68', '72', '76', 'C', 5, 6, 30),
  (v_multiplication_set, 'A bus carries 35 students. How many students in 4 buses?', '120', '130', '140', '150', 'C', 5, 7, 30),
  (v_multiplication_set, 'Each student solves 18 questions. 5 students solve them. Total questions?', '80', '85', '90', '95', 'C', 5, 8, 30),
  (v_multiplication_set, 'A school buys 25 books for each of 8 classes. Total books?', '180', '190', '200', '210', 'C', 5, 9, 30),
  (v_multiplication_set, 'A game gives 30 points per level. How many points for 7 levels?', '190', '200', '210', '220', 'C', 5, 10, 30);
end $$;
