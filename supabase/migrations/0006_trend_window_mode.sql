-- Neon UX rework: the Trends window can now be anchored to a phase-log event instead of a
-- fixed week count. 'weeks' uses settings.trend_window as-is; the other three scope the chart
-- window to a phase-log anchor (see lib/math.phaseAnchoredShowN on the client).
--
-- This replaces trend_horizon: the chart's forward projection now follows the Reach solver's
-- solved weeks, so the client no longer sends a horizon. upsertSettings() writes
-- trend_window_mode on every settings sync, so the column has to exist for settings to persist.

alter table settings add column if not exists trend_window_mode text not null default 'weeks'
  check (trend_window_mode in ('weeks', 'phaseStart', 'lastDeload', 'lastMaintain'));

alter table settings drop column if exists trend_horizon;
