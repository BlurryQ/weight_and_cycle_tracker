-- Cycle tracking: one row per logged period start. Everything else (phase boundaries,
-- predictions) is derived on the client from these starts plus the user's median cycle length.
-- Same RLS + composite-PK shape as entries / phase_log — one real user, many devices.

create table if not exists cycle_log (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  start date not null,
  -- optional; null = ongoing or never logged. Only refines menstrual-phase length.
  end_date date,
  note text,
  updated_at timestamptz not null default now(),
  primary key (user_id, start),
  constraint cycle_log_end_after_start check (end_date is null or end_date >= start)
);
alter table cycle_log enable row level security;
create policy "own rows" on cycle_log for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger cycle_log_set_updated_at before update on cycle_log
  for each row execute function set_updated_at();

-- Cycle screen range control, mirrors settings.trend_window.
alter table settings add column if not exists cycle_window smallint not null default 13
  check (cycle_window in (8, 13, 26));
