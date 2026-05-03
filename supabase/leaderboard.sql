-- Leaderboard (leaderboard_points, trigger, views) is defined in supabase/schema.sql
-- in the section after "teacher manages progress for own classes" (search for "Leaderboard:").
--
-- New projects: run schema.sql only — no separate leaderboard step.
-- Older databases: copy that block from the current schema.sql into the SQL editor and run it,
-- or check out a previous commit that still contained the full standalone leaderboard.sql.

select 1 as leaderboard_definitions_are_in_schema_sql;
