-- Replace UUIDs, then run in Supabase SQL Editor (postgres bypasses RLS).
do $$
declare
  v_teacher_id uuid := 'PASTE_TEACHER_PROFILE_ID_HERE';
  v_class_id uuid := 'PASTE_CLASS_ID_HERE';
  v_subtraction_set uuid;
begin
  delete from public.question_sets
  where class_id = v_class_id
    and title = 'Subtraction Basics';

  insert into public.question_sets (teacher_id, class_id, title, topic, description, threshold_score, is_active)
  values (v_teacher_id, v_class_id, 'Subtraction Basics', 'Subtraction', 'Subtraction questions from Level 1 to Level 5.', 70, true)
  returning id into v_subtraction_set;

  insert into public.questions
  (question_set_id, question_text, option_a, option_b, option_c, option_d, correct_answer, difficulty_level, sequence_order, points)
  values
  (v_subtraction_set, '5 - 2 = ?', '2', '3', '4', '5', 'B', 1, 1, 10),
  (v_subtraction_set, '7 - 3 = ?', '3', '4', '5', '6', 'B', 1, 2, 10),
  (v_subtraction_set, '9 - 5 = ?', '2', '3', '4', '5', 'C', 1, 3, 10),
  (v_subtraction_set, '6 - 1 = ?', '4', '5', '6', '7', 'B', 1, 4, 10),
  (v_subtraction_set, '8 - 2 = ?', '5', '6', '7', '8', 'B', 1, 5, 10),
  (v_subtraction_set, '10 - 4 = ?', '5', '6', '7', '8', 'B', 1, 6, 10),
  (v_subtraction_set, '11 - 5 = ?', '4', '5', '6', '7', 'C', 1, 7, 10),
  (v_subtraction_set, '12 - 6 = ?', '5', '6', '7', '8', 'B', 1, 8, 10),
  (v_subtraction_set, '13 - 7 = ?', '5', '6', '7', '8', 'B', 1, 9, 10),
  (v_subtraction_set, '14 - 8 = ?', '4', '5', '6', '7', 'C', 1, 10, 10),
  (v_subtraction_set, '25 - 10 = ?', '10', '15', '20', '25', 'B', 2, 1, 15),
  (v_subtraction_set, '30 - 12 = ?', '16', '17', '18', '19', 'C', 2, 2, 15),
  (v_subtraction_set, '45 - 20 = ?', '20', '25', '30', '35', 'B', 2, 3, 15),
  (v_subtraction_set, '50 - 15 = ?', '30', '35', '40', '45', 'B', 2, 4, 15),
  (v_subtraction_set, '38 - 18 = ?', '18', '19', '20', '21', 'C', 2, 5, 15),
  (v_subtraction_set, '60 - 25 = ?', '30', '35', '40', '45', 'B', 2, 6, 15),
  (v_subtraction_set, '72 - 30 = ?', '40', '41', '42', '43', 'C', 2, 7, 15),
  (v_subtraction_set, '90 - 45 = ?', '40', '45', '50', '55', 'B', 2, 8, 15),
  (v_subtraction_set, '81 - 19 = ?', '60', '61', '62', '63', 'C', 2, 9, 15),
  (v_subtraction_set, '100 - 40 = ?', '50', '55', '60', '65', 'C', 2, 10, 15),
  (v_subtraction_set, '125 - 48 = ?', '75', '76', '77', '78', 'C', 3, 1, 20),
  (v_subtraction_set, '200 - 75 = ?', '115', '120', '125', '130', 'C', 3, 2, 20),
  (v_subtraction_set, '340 - 125 = ?', '205', '210', '215', '220', 'C', 3, 3, 20),
  (v_subtraction_set, '500 - 245 = ?', '245', '250', '255', '260', 'C', 3, 4, 20),
  (v_subtraction_set, '612 - 308 = ?', '300', '304', '308', '312', 'B', 3, 5, 20),
  (v_subtraction_set, '731 - 456 = ?', '265', '270', '275', '280', 'C', 3, 6, 20),
  (v_subtraction_set, '850 - 399 = ?', '449', '450', '451', '452', 'C', 3, 7, 20),
  (v_subtraction_set, '999 - 555 = ?', '333', '444', '555', '666', 'B', 3, 8, 20),
  (v_subtraction_set, '430 - 178 = ?', '242', '252', '262', '272', 'B', 3, 9, 20),
  (v_subtraction_set, '704 - 289 = ?', '405', '415', '425', '435', 'B', 3, 10, 20),
  (v_subtraction_set, '1,250 - 475 = ?', '765', '775', '785', '795', 'B', 4, 1, 25),
  (v_subtraction_set, '2,000 - 865 = ?', '1,125', '1,135', '1,145', '1,155', 'B', 4, 2, 25),
  (v_subtraction_set, '3,456 - 1,234 = ?', '2,122', '2,222', '2,322', '2,422', 'B', 4, 3, 25),
  (v_subtraction_set, '5,000 - 2,789 = ?', '2,201', '2,211', '2,221', '2,231', 'B', 4, 4, 25),
  (v_subtraction_set, '4,321 - 987 = ?', '3,324', '3,334', '3,344', '3,354', 'B', 4, 5, 25),
  (v_subtraction_set, '7,500 - 3,250 = ?', '4,150', '4,250', '4,350', '4,450', 'B', 4, 6, 25),
  (v_subtraction_set, '6,789 - 4,321 = ?', '2,458', '2,468', '2,478', '2,488', 'B', 4, 7, 25),
  (v_subtraction_set, '9,999 - 5,555 = ?', '4,222', '4,333', '4,444', '4,555', 'C', 4, 8, 25),
  (v_subtraction_set, '8,000 - 3,675 = ?', '4,225', '4,325', '4,425', '4,525', 'B', 4, 9, 25),
  (v_subtraction_set, '10,000 - 6,789 = ?', '3,201', '3,211', '3,221', '3,231', 'B', 4, 10, 25),
  (v_subtraction_set, 'Ama had 20 pencils and gave away 8. How many are left?', '10', '11', '12', '13', 'C', 5, 1, 30),
  (v_subtraction_set, 'A bus had 45 people. 17 got off. How many remained?', '26', '27', '28', '29', 'C', 5, 2, 30),
  (v_subtraction_set, 'A shop had 100 oranges and sold 36. How many are left?', '62', '63', '64', '65', 'C', 5, 3, 30),
  (v_subtraction_set, 'There were 80 students. 25 went home. How many stayed?', '50', '55', '60', '65', 'B', 5, 4, 30),
  (v_subtraction_set, 'Kofi saved 75 cedis and spent 28. How much remains?', '45', '46', '47', '48', 'C', 5, 5, 30),
  (v_subtraction_set, 'A farmer had 120 eggs and sold 49. How many eggs are left?', '69', '70', '71', '72', 'C', 5, 6, 30),
  (v_subtraction_set, 'A library had 250 books. 85 were borrowed. How many remain?', '155', '160', '165', '170', 'C', 5, 7, 30),
  (v_subtraction_set, 'A game score was 500 points. 125 points were lost. What is left?', '350', '365', '375', '385', 'C', 5, 8, 30),
  (v_subtraction_set, 'A class target was 1,000 points. They earned 675. How many more are needed?', '315', '325', '335', '345', 'B', 5, 9, 30),
  (v_subtraction_set, 'A school had 1,500 chairs and moved 620 away. How many stayed?', '870', '880', '890', '900', 'B', 5, 10, 30);
end $$;
