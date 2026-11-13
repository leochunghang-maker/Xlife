-- Xlife cloud schema (Supabase / Postgres).
-- Documents mirror the app's localStorage records as JSONB so the
-- localStorage -> cloud migration is lossless. Row Level Security is ON for
-- every table: a user can only read/write their own rows; a paired partner can
-- read only the categories the owner has explicitly shared (couple_shares).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  birthday date,
  gender text,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create a profile row automatically on sign-up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- couples
create table if not exists public.couples (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users (id) on delete cascade,
  user_b uuid not null references auth.users (id) on delete cascade,
  anniversary date,
  created_at timestamptz not null default now(),
  constraint couples_distinct check (user_a <> user_b)
);
create unique index if not exists couples_user_a_key on public.couples (user_a);
create unique index if not exists couples_user_b_key on public.couples (user_b);

create table if not exists public.couple_invites (
  code text primary key,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_by uuid references auth.users (id),
  used_at timestamptz
);

-- Per-category sharing chosen by the data owner. Missing row = not shared.
create table if not exists public.couple_shares (
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null check (category in ('memories','plans','meals','workouts','mood','sleep','spending','cycle','intimacy','journal')),
  shared boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, category)
);

-- The other member of the caller's couple (null if unpaired).
create or replace function public.partner_of(uid uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select case when c.user_a = uid then c.user_b else c.user_a end
  from public.couples c where c.user_a = uid or c.user_b = uid limit 1
$$;

-- True when `viewer` is paired with `owner` and owner shares `cat`.
create or replace function public.partner_can_read(owner uuid, cat text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.couple_shares s
    where s.user_id = owner and s.category = cat and s.shared
      and public.partner_of(owner) = auth.uid()
  )
$$;

-- Generate an invite code (8 chars, no ambiguous letters). One open code per user.
create or replace function public.create_couple_invite()
returns text language plpgsql security definer set search_path = public as $$
declare
  new_code text;
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if public.partner_of(auth.uid()) is not null then raise exception 'already paired'; end if;
  delete from public.couple_invites where created_by = auth.uid() and used_by is null;
  loop
    new_code := '';
    for i in 1..8 loop
      new_code := new_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.couple_invites where code = new_code);
  end loop;
  insert into public.couple_invites (code, created_by) values (new_code, auth.uid());
  return new_code;
end $$;

-- Accept a partner's code: creates the couple. Codes are single-use and expire.
create or replace function public.accept_couple_invite(invite_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  invite public.couple_invites;
  couple_id uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into invite from public.couple_invites
    where code = upper(trim(invite_code)) and used_by is null and expires_at > now()
    for update;
  if not found then raise exception 'invalid or expired code'; end if;
  if invite.created_by = auth.uid() then raise exception 'cannot use your own code'; end if;
  if public.partner_of(auth.uid()) is not null or public.partner_of(invite.created_by) is not null then
    raise exception 'already paired';
  end if;
  insert into public.couples (user_a, user_b) values (invite.created_by, auth.uid()) returning id into couple_id;
  update public.couple_invites set used_by = auth.uid(), used_at = now() where code = invite.code;
  return couple_id;
end $$;

create or replace function public.leave_couple()
returns void language sql security definer set search_path = public as $$
  delete from public.couples where user_a = auth.uid() or user_b = auth.uid();
$$;

-- ---------------------------------------------------------------- data tables
-- Every data table: id text (client id), user_id, optional date, data jsonb.
do $$
declare
  t text;
begin
  foreach t in array array['daily_logs','meals','workouts','spending','sleep_logs','period_logs','restaurants','plans','memories','intimacy_logs','journal_entries'] loop
    execute format($f$
      create table if not exists public.%1$I (
        id text primary key,
        user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
        date date,
        data jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
      create index if not exists %1$s_user_date_idx on public.%1$I (user_id, date);
      alter table public.%1$I enable row level security;
      drop policy if exists "%1$s owner all" on public.%1$I;
      create policy "%1$s owner all" on public.%1$I for all
        using (user_id = auth.uid()) with check (user_id = auth.uid());
    $f$, t);
  end loop;
end $$;

-- Partner read policies, one category per table.
drop policy if exists "memories partner read" on public.memories;
create policy "memories partner read" on public.memories for select using (public.partner_can_read(user_id, 'memories'));
drop policy if exists "plans partner read" on public.plans;
create policy "plans partner read" on public.plans for select using (public.partner_can_read(user_id, 'plans'));
drop policy if exists "meals partner read" on public.meals;
create policy "meals partner read" on public.meals for select using (public.partner_can_read(user_id, 'meals'));
drop policy if exists "workouts partner read" on public.workouts;
create policy "workouts partner read" on public.workouts for select using (public.partner_can_read(user_id, 'workouts'));
drop policy if exists "sleep partner read" on public.sleep_logs;
create policy "sleep partner read" on public.sleep_logs for select using (public.partner_can_read(user_id, 'sleep'));
drop policy if exists "spending partner read" on public.spending;
create policy "spending partner read" on public.spending for select using (public.partner_can_read(user_id, 'spending'));
drop policy if exists "period partner read" on public.period_logs;
create policy "period partner read" on public.period_logs for select using (public.partner_can_read(user_id, 'cycle'));
drop policy if exists "intimacy partner read" on public.intimacy_logs;
create policy "intimacy partner read" on public.intimacy_logs for select using (public.partner_can_read(user_id, 'intimacy'));
drop policy if exists "journal partner read" on public.journal_entries;
create policy "journal partner read" on public.journal_entries for select using (public.partner_can_read(user_id, 'journal'));
-- daily_logs hold mixed categories (mood, notes, sleep...) so partners never read them directly.

-- ---------------------------------------------------------------- RLS: social tables
alter table public.profiles enable row level security;
drop policy if exists "profiles self" on public.profiles;
create policy "profiles self" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists "profiles partner read" on public.profiles;
create policy "profiles partner read" on public.profiles for select using (id = public.partner_of(auth.uid()));

alter table public.couples enable row level security;
drop policy if exists "couples members read" on public.couples;
create policy "couples members read" on public.couples for select using (auth.uid() in (user_a, user_b));
drop policy if exists "couples members update" on public.couples;
create policy "couples members update" on public.couples for update using (auth.uid() in (user_a, user_b)) with check (auth.uid() in (user_a, user_b));
-- Inserts/deletes only through the security-definer functions above.

alter table public.couple_invites enable row level security;
drop policy if exists "invites own read" on public.couple_invites;
create policy "invites own read" on public.couple_invites for select using (created_by = auth.uid());

alter table public.couple_shares enable row level security;
drop policy if exists "shares owner all" on public.couple_shares;
create policy "shares owner all" on public.couple_shares for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "shares partner read" on public.couple_shares;
create policy "shares partner read" on public.couple_shares for select using (user_id = public.partner_of(auth.uid()));

grant execute on function public.create_couple_invite() to authenticated;
grant execute on function public.accept_couple_invite(text) to authenticated;
grant execute on function public.leave_couple() to authenticated;
revoke execute on function public.partner_of(uuid) from anon;
revoke execute on function public.partner_can_read(uuid, text) from anon;

-- ---------------------------------------------------------------- Storage
-- Private bucket; objects live under <user_id>/<photo_id>.jpg.
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

drop policy if exists "photos owner all" on storage.objects;
create policy "photos owner all" on storage.objects for all
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "photos partner read shared memories" on storage.objects;
create policy "photos partner read shared memories" on storage.objects for select
  using (bucket_id = 'photos' and public.partner_can_read(((storage.foldername(name))[1])::uuid, 'memories'));

-- AI usage log for simple per-user rate limiting in the edge function.
create table if not exists public.ai_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  created_at timestamptz not null default now()
);
alter table public.ai_requests enable row level security;
drop policy if exists "ai own read" on public.ai_requests;
create policy "ai own read" on public.ai_requests for select using (user_id = auth.uid());
