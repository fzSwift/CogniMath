-- Fix: allow promoting users teacher→admin from Supabase SQL Editor (auth.uid() is null there).
-- Safe to re-run.

create or replace function public.enforce_profile_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    if auth.uid() is not null then
      if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') then
        raise exception 'Only an admin may change profiles.role';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_role_guard on public.profiles;
create trigger profiles_role_guard
before update on public.profiles
for each row execute function public.enforce_profile_role_change();
