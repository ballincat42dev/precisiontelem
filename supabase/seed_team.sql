
-- Team seed helper: base name + odd sequence using +3 then round to nearest odd (ties round UP).
-- This yields: 1,5,9,13,... (monotonic forward).

create table if not exists team_seed_state (
  base_name text primary key,
  last_n int not null default 0
);

create or replace function next_team_label(base text)
returns text
language plpgsql
as $$
declare
  current_n int;
  candidate int;
  next_n int;
  label text;
begin
  select coalesce(last_n, 0) into current_n from team_seed_state where base_name = base;
  if not found then
    insert into team_seed_state(base_name, last_n) values (base, 1);
    return base || ' ' || 1;
  end if;

  candidate := current_n + 3;
  if (candidate % 2) = 0 then
    -- even → round to nearest odd; tie rounds UP to keep forward-only
    next_n := candidate + 1;
  else
    next_n := candidate;
  end if;

  update team_seed_state set last_n = next_n where base_name = base;
  label := base || ' ' || next_n;
  return label;
end;
$$;

-- Example usage:
-- select next_team_label('Precision');
-- insert into team(name) values (next_team_label('Precision'));
