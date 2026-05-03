-- Run this in Supabase SQL Editor if you already applied an older schema.sql
-- without class invite codes and join requests. Safe to run once (idempotent).

alter table public.classes add column if not exists invite_code text;
alter table public.classes add column if not exists archived_at timestamp with time zone;

create unique index if not exists classes_invite_code_key on public.classes (invite_code)
  where invite_code is not null;

create table if not exists public.class_join_requests (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references public.classes (id) on delete cascade not null,
  full_name text not null,
  username text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamp with time zone default now()
);

create unique index if not exists class_join_requests_one_pending_per_student
  on public.class_join_requests (class_id, lower(username))
  where status = 'pending';

alter table public.class_join_requests enable row level security;

drop policy if exists "teacher reads join requests for own classes" on public.class_join_requests;

create policy "teacher reads join requests for own classes" on public.class_join_requests
for select using (
  exists (
    select 1 from public.classes c
    where c.id = class_join_requests.class_id and c.teacher_id = auth.uid()
  )
);

create or replace function public.submit_class_join_request(
  p_invite_code text,
  p_full_name text,
  p_username text
)
returns uuid
language plpgsql
security definer
set search_path = public as $$
declare
  v_class_id uuid;
  v_username text;
  v_req_id uuid;
begin
  v_username := lower(trim(p_username));
  if length(v_username) < 2 then
    raise exception 'Invalid username';
  end if;

  select id into v_class_id
  from public.classes
  where invite_code is not null
    and archived_at is null
    and upper(trim(invite_code)) = upper(trim(p_invite_code));

  if v_class_id is null then
    raise exception 'Invalid or inactive join code';
  end if;

  if exists (
    select 1 from public.class_join_requests r
    where r.class_id = v_class_id
      and lower(r.username) = v_username
      and r.status = 'pending'
  ) then
    raise exception 'Join request already pending';
  end if;

  if exists (
    select 1
    from public.class_students cs
    join public.students s on s.id = cs.student_id
    where cs.class_id = v_class_id and lower(s.username) = v_username
  ) then
    raise exception 'Already enrolled in this class';
  end if;

  insert into public.class_join_requests (class_id, full_name, username, status)
  values (v_class_id, trim(p_full_name), v_username, 'pending')
  returning id into v_req_id;

  return v_req_id;
end;
$$;

create or replace function public.approve_class_join_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public as $$
declare
  v_class_id uuid;
  v_full_name text;
  v_username text;
  v_status text;
  v_teacher_id uuid;
  v_student_id uuid;
begin
  select cjr.class_id, cjr.full_name, cjr.username, cjr.status, c.teacher_id
  into v_class_id, v_full_name, v_username, v_status, v_teacher_id
  from public.class_join_requests cjr
  join public.classes c on c.id = cjr.class_id
  where cjr.id = p_request_id
  for update of cjr;

  if not found then
    raise exception 'Request not found';
  end if;

  if v_teacher_id <> auth.uid() then
    raise exception 'Not authorized';
  end if;

  if v_status <> 'pending' then
    raise exception 'Request is not pending';
  end if;

  select id into v_student_id from public.students where lower(username) = lower(v_username);

  if v_student_id is null then
    insert into public.students (full_name, username, class_level)
    values (v_full_name, v_username, null)
    returning id into v_student_id;
  else
    update public.students set full_name = v_full_name where id = v_student_id;
  end if;

  insert into public.class_students (class_id, student_id)
  values (v_class_id, v_student_id)
  on conflict (class_id, student_id) do nothing;

  update public.class_join_requests set status = 'approved' where id = p_request_id;
end;
$$;

create or replace function public.reject_class_join_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public as $$
declare
  v_teacher_id uuid;
  v_status text;
begin
  select c.teacher_id, cjr.status
  into v_teacher_id, v_status
  from public.class_join_requests cjr
  join public.classes c on c.id = cjr.class_id
  where cjr.id = p_request_id
  for update of cjr;

  if not found then
    raise exception 'Request not found';
  end if;

  if v_teacher_id <> auth.uid() then
    raise exception 'Not authorized';
  end if;

  if v_status <> 'pending' then
    raise exception 'Request is not pending';
  end if;

  update public.class_join_requests set status = 'rejected' where id = p_request_id;
end;
$$;

grant execute on function public.submit_class_join_request(text, text, text) to anon, authenticated;
grant execute on function public.approve_class_join_request(uuid) to authenticated;
grant execute on function public.reject_class_join_request(uuid) to authenticated;
