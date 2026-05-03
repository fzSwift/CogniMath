export interface Profile {
  id: string;
  full_name: string;
  role: string;
  created_at: string;
}

export interface ClassRoom {
  id: string;
  teacher_id: string;
  class_name: string;
  description: string | null;
  invite_code: string | null;
  archived_at: string | null;
  created_at: string;
}

/** Row from `class_dashboard_row` (list cards + health). */
export interface ClassDashboardRow {
  id: string;
  teacher_id: string;
  class_name: string;
  description: string | null;
  invite_code: string | null;
  archived_at: string | null;
  created_at: string;
  student_count: number;
  question_set_count: number;
  pending_join_count: number;
  avg_score_pct: number | string;
  last_activity_at: string | null;
  attempt_count: number;
  passed_attempt_count: number;
}

export interface ClassJoinRequest {
  id: string;
  class_id: string;
  full_name: string;
  username: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

/** Row from class_students with nested class (teacher RLS scopes to own classes). PostgREST may type nested rows as an array. */
export type ClassSummary = Pick<ClassRoom, "id" | "class_name" | "description">;

export interface StudentClassEnrollment {
  id: string;
  class_id: string;
  classes: ClassSummary | ClassSummary[] | null;
}

export interface Student {
  id: string;
  full_name: string;
  username: string;
  class_level: string | null;
  /** Null when active; set when soft-archived (requires DB migration). */
  archived_at?: string | null;
  created_at: string;
}

/** Row from `student_teacher_metrics` (teacher-scoped list + aggregates). */
export interface StudentTeacherMetric {
  student_id: string;
  full_name: string;
  username: string;
  class_level: string | null;
  created_at: string;
  archived_at: string | null;
  class_count: number | string;
  last_activity_at: string | null;
  attempt_count: number | string;
  avg_pct: number | string;
  passed_count: number | string;
}

export interface QuestionSet {
  id: string;
  teacher_id: string;
  class_id: string;
  title: string;
  topic: string;
  description: string | null;
  threshold_score: number;
  is_active: boolean;
  created_at: string;
}

export interface Question {
  id: string;
  question_set_id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: "A" | "B" | "C" | "D";
  difficulty_level: number;
  sequence_order: number;
  points: number;
  created_at: string;
}

export interface StudentAttempt {
  id: string;
  student_id: string;
  question_set_id: string;
  difficulty_level: number;
  score: number;
  total_questions: number;
  percentage: number;
  passed: boolean;
  started_at: string;
  completed_at: string;
}

export interface StudentAnswer {
  id: string;
  attempt_id: string;
  student_id: string;
  question_id: string;
  selected_answer: string;
  correct_answer: string;
  is_correct: boolean;
  answered_at: string;
}

export interface DashboardStats {
  totalClasses: number;
  totalStudents: number;
  totalQuestionSets: number;
  averagePerformance: number;
}

/** `student_attempts` row with joined labels for dashboard lists. */
export interface StudentAttemptWithLabels {
  id: string;
  student_id?: string;
  percentage: number | string;
  passed: boolean;
  completed_at?: string;
  students?: { full_name: string } | null;
  question_sets?: { id: string; title: string } | null;
}

/** Row from weekly/monthly/term student leaderboard views (RLS: teacher’s classes only). */
export interface StudentLeaderboardRow {
  student_id: string;
  student_name: string;
  class_id: string;
  class_name: string;
  total_points: number | string;
  rank: number | string;
  overall_rank: number | string;
}

/** Row from weekly/monthly class leaderboard views. */
export interface ClassLeaderboardRow {
  class_id: string;
  class_name: string;
  total_class_points: number | string;
  rank: number | string;
}

export interface ClassPerformanceViewRow {
  class_id: string;
  class_name: string;
  student_name: string;
  /** Present after `upgrade_analytics_views.sql` / current schema. */
  question_set_id?: string;
  question_set_title: string;
  average_percentage: number | string;
  total_attempts: number;
  passed_attempts: number;
}

export interface WeakTopicsViewRow {
  class_id: string;
  /** Present after `upgrade_students_features` / current schema. */
  student_id?: string;
  topic: string;
  student_name: string;
  average_score: number | string;
  wrong_answers_count: number | string;
}
