import { supabase } from "./supabase";

/** Ensures profiles row + starter class (see supabase bootstrap_teacher_workspace). */
export async function bootstrapTeacherWorkspace(): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("bootstrap_teacher_workspace");
  return { error: error?.message ?? null };
}
