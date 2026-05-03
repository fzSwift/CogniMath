-- Repair teacher onboarding: missing profiles row + optional starter class.
-- Run on existing Supabase projects. Safe to re-run.

create or replace function public.bootstrap_teacher_workspace()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  meta jsonb;
  em text;
  v_teacher_name text;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (select 1 from public.profiles p where p.id = uid) then
    select u.raw_user_meta_data, u.email into meta, em
    from auth.users u
    where u.id = uid;
    if not found then
      raise exception 'Auth user missing';
    end if;
    insert into public.profiles (id, full_name, role)
    values (
      uid,
      coalesce(
        nullif(trim(meta->>'full_name'), ''),
        nullif(trim(split_part(em, '@', 1)), ''),
        'Teacher'
      ),
      'teacher'
    )
    on conflict (id) do nothing;
  end if;

  select coalesce(nullif(trim(p.full_name), ''), 'Your teacher') into v_teacher_name
  from public.profiles p
  where p.id = uid;

  insert into public.classes (teacher_id, class_name, description)
  select
    uid,
    'My class',
    'Teacher: ' || v_teacher_name || E'.\n\nYou can rename this class and edit this text under Classes.'
  where not exists (select 1 from public.classes c where c.teacher_id = uid);
end;
$$;

revoke all on function public.bootstrap_teacher_workspace() from public;
grant execute on function public.bootstrap_teacher_workspace() to authenticated;
