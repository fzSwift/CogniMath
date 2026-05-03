-- Teacher dashboard: create student + enroll in one transaction (pick-a-class flow).
-- Safe to re-run.

create or replace function public.create_student_for_class(
  p_class_id uuid,
  p_full_name text,
  p_username text,
  p_class_level text default null
)
returns uuid
language plpgsql
security definer
set search_path = public as $$
declare
  v_student_id uuid;
  v_username text;
  v_level text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.classes c
    where c.id = p_class_id
      and c.archived_at is null
      and (
        c.teacher_id = auth.uid()
        or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
      )
  ) then
    raise exception 'Class not found or access denied';
  end if;

  if length(trim(coalesce(p_full_name, ''))) < 1 then
    raise exception 'Full name is required';
  end if;

  v_username := lower(trim(p_username));
  if length(v_username) < 2 then
    raise exception 'Username must be at least 2 characters';
  end if;

  v_level := nullif(trim(coalesce(p_class_level, '')), '');

  insert into public.students (full_name, username, class_level, archived_at, created_by_teacher_id)
  values (trim(p_full_name), v_username, v_level, null, auth.uid())
  returning id into v_student_id;

  insert into public.class_students (class_id, student_id)
  values (p_class_id, v_student_id);

  return v_student_id;
exception
  when unique_violation then
    raise exception 'That username is already in use';
end;
$$;

grant execute on function public.create_student_for_class(uuid, text, text, text) to authenticated;
