-- Daily couple question (BeReal "post to see" style): your partner's answer is
-- readable only after you've answered the same day's question yourself.
create table if not exists public.couple_answers (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  question text not null,
  answer text not null check (length(answer) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);
alter table public.couple_answers enable row level security;

create or replace function public.has_answered(uid uuid, day date)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.couple_answers where user_id = uid and date = day)
$$;
revoke execute on function public.has_answered(uuid, date) from anon;

drop policy if exists "answers owner all" on public.couple_answers;
create policy "answers owner all" on public.couple_answers for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "answers partner read after answering" on public.couple_answers;
create policy "answers partner read after answering" on public.couple_answers for select
  using (user_id = public.partner_of(auth.uid()) and public.has_answered(auth.uid(), date));
