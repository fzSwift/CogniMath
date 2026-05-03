-- Replace open leaderboard_points SELECT with teacher-scoped read (own classes only).
-- Run if you deployed leaderboard before teacher RLS was added.
-- Safe to re-run.

drop policy if exists "leaderboard_points_select_public" on public.leaderboard_points;
drop policy if exists "teacher reads leaderboard_points in own classes" on public.leaderboard_points;

create policy "teacher reads leaderboard_points in own classes" on public.leaderboard_points
for select using (
  exists (
    select 1
    from public.classes c
    where c.id = leaderboard_points.class_id
      and c.teacher_id = auth.uid()
  )
);
