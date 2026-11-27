-- Additive upgrade: pairing only through consent RPCs; photos are record-scoped.
-- Apply AFTER both 20261113 migrations. No data or storage objects are deleted.
begin;
drop policy if exists "couples members update" on public.couples;
revoke insert, update, delete on public.couples from anon, authenticated;
revoke insert, update, delete on public.couple_invites from anon, authenticated;

create or replace function public.reject_couple_member_change()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.user_a is distinct from old.user_a or new.user_b is distinct from old.user_b then
    raise exception 'Couple membership is immutable; leave and accept a new invitation';
  end if;
  return new;
end $$;
drop trigger if exists couples_immutable_members on public.couples;
create trigger couples_immutable_members before update on public.couples
for each row execute function public.reject_couple_member_change();

-- Helpers must not act as arbitrary-user relationship/answer oracles.
create or replace function public.partner_of(uid uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select case when c.user_a = uid then c.user_b else c.user_a end
    from public.couples c where uid in (c.user_a, c.user_b)
      and auth.uid() in (c.user_a, c.user_b)
      -- Legacy swapped/directly forged pairs have no matching acceptance.
      -- Both timestamps use transaction now() in the old and new accept RPC.
      and exists(select 1 from public.couple_invites i where i.created_by = c.user_a
        and i.used_by = c.user_b and i.used_at = c.created_at) limit 1
$$;
create or replace function public.has_answered(uid uuid, day date)
returns boolean language sql stable security definer set search_path = public as $$
  select uid = auth.uid() and exists(select 1 from public.couple_answers where user_id = uid and date = day)
$$;

create or replace function public.create_couple_invite()
returns text language plpgsql security definer set search_path = public as $$
declare new_code text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  -- Serialize membership/invite transitions, including cross-column races.
  perform pg_advisory_xact_lock(824611190);
  if exists(select 1 from public.couples where auth.uid() in (user_a,user_b)) then raise exception 'already paired; disconnect first'; end if;
  update public.couple_invites set expires_at = least(expires_at, now())
    where created_by = auth.uid() and used_by is null;
  new_code := upper(replace(gen_random_uuid()::text, '-', ''));
  insert into public.couple_invites(code, created_by) values(new_code, auth.uid());
  return new_code;
end $$;

create or replace function public.accept_couple_invite(invite_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare invitation public.couple_invites; couple_id uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  perform pg_advisory_xact_lock(824611190);
  select * into invitation from public.couple_invites
    where code = upper(trim(invite_code)) and used_by is null and expires_at > now() for update;
  if not found then raise exception 'invalid or expired code'; end if;
  if invitation.created_by = auth.uid() then raise exception 'cannot use your own code'; end if;
  if exists (select 1 from public.couples where user_a in (auth.uid(), invitation.created_by)
      or user_b in (auth.uid(), invitation.created_by)) then raise exception 'already paired'; end if;
  insert into public.couples(user_a, user_b) values(invitation.created_by, auth.uid()) returning id into couple_id;
  update public.couple_invites set used_by = auth.uid(), used_at = now() where code = invitation.code;
  -- Revoke other invitations on BOTH sides; an old pre-pair code is not consent after disconnect.
  update public.couple_invites set expires_at = least(expires_at, now())
    where created_by in (invitation.created_by, auth.uid()) and used_by is null;
  return couple_id;
end $$;

create or replace function public.leave_couple()
returns void language plpgsql security definer set search_path = public as $$
declare partner uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  perform pg_advisory_xact_lock(824611190);
  partner := public.partner_of(auth.uid());
  update public.couple_invites set expires_at = least(expires_at, now())
    where created_by in (auth.uid(), partner) and used_by is null;
  delete from public.couples where auth.uid() in (user_a, user_b);
end $$;

-- Exact JSON string references, never substring, URL, encoded path, or filename matches.
create or replace function public.photo_referenced(payload jsonb, ref text)
returns boolean language sql immutable set search_path = public as $$
  select exists (select 1 from jsonb_path_query(payload, 'strict $.**') v where v = to_jsonb(ref))
$$;

create or replace function public.partner_can_read_photo(object_name text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare owner_id uuid; ref text; entry record; referenced boolean; allowed boolean := false;
begin
  if auth.uid() is null or object_name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9-]+[.]jpg$' then return false; end if;
  owner_id := split_part(object_name, '/', 1)::uuid;
  if public.partner_of(owner_id) is distinct from auth.uid() then return false; end if;
  ref := 'xlife-photo:' || split_part(split_part(object_name, '/', 2), '.', 1);
  -- Every referencing category must permit sharing. A private spending photo
  -- cannot be laundered by also referencing it from a shared memory.
  for entry in select * from (values
    ('memories','memories'), ('meals','meals'), ('plans','plans'), ('workouts','workouts'),
    ('spending','spending'), ('sleep_logs','sleep'), ('period_logs','cycle'),
    ('intimacy_logs','intimacy'), ('journal_entries','journal'), ('restaurants','private')
  ) categories(tbl, cat) loop
    execute format('select exists(select 1 from public.%I where user_id = $1 and public.photo_referenced(data, $2))', entry.tbl)
      into referenced using owner_id, ref;
    if referenced then
      if entry.cat in ('cycle','sleep','intimacy','journal','private') or not public.partner_can_read(owner_id, entry.cat) then return false; end if;
      allowed := true;
    end if;
  end loop;
  -- daily_logs is a private aggregate; only its explicit snaps/meals slots are
  -- shareable via their dedicated tables. Any other embedded reference is private.
  if exists(select 1 from public.daily_logs where user_id = owner_id
      and public.photo_referenced(data - 'snaps' - 'meals', ref)) then return false; end if;
  return allowed;
end $$;

drop policy if exists "photos partner read shared memories" on storage.objects;
drop policy if exists "photos partner read referenced records" on storage.objects;
create policy "photos partner read referenced records" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and public.partner_can_read_photo(name));
update storage.buckets set public = false where id = 'photos';

-- Legacy unused short codes must be regenerated; keep their records for audit.
update public.couple_invites set expires_at = least(expires_at, now())
  where used_by is null and (length(code) <> 32 or exists (
    select 1 from public.couples where created_by in (user_a, user_b)));

-- PostgreSQL grants new functions to PUBLIC by default (revoking anon alone is insufficient).
revoke all on function public.create_couple_invite(), public.accept_couple_invite(text), public.leave_couple(),
  public.partner_of(uuid), public.partner_can_read(uuid,text), public.partner_can_read_photo(text),
  public.photo_referenced(jsonb,text), public.reject_couple_member_change(), public.has_answered(uuid,date) from public, anon;
grant execute on function public.create_couple_invite(), public.accept_couple_invite(text), public.leave_couple(),
  public.partner_of(uuid), public.partner_can_read(uuid,text), public.partner_can_read_photo(text), public.has_answered(uuid,date) to authenticated;
commit;
