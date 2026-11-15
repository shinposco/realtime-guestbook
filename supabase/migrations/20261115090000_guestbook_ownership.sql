begin;

create schema guestbook_private;
revoke all on schema guestbook_private from public, anon, authenticated;

create table guestbook_private.entry_ownership (
  entry_id uuid primary key references public.entries(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  request_fingerprint text not null
);

create table guestbook_private.comment_ownership (
  comment_id uuid primary key references public.comments(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  request_fingerprint text not null
);

create index entry_ownership_author_idx on guestbook_private.entry_ownership (author_id);
create index comment_ownership_author_idx on guestbook_private.comment_ownership (author_id);

alter table guestbook_private.entry_ownership enable row level security;
alter table guestbook_private.comment_ownership enable row level security;
revoke all on all tables in schema guestbook_private from public, anon, authenticated, service_role;

create function public.register_guestbook_entry(
  p_id uuid, p_author_id uuid, p_fingerprint text, p_nickname text,
  p_message text, p_image_type text, p_image_path text
) returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  if p_author_id is null then
    raise exception 'An authenticated author is required' using errcode = '22004';
  end if;

  insert into public.entries (id, nickname, message, image_type, image_path)
  values (p_id, p_nickname, p_message, p_image_type, p_image_path)
  on conflict (id) do nothing;

  if found then
    insert into guestbook_private.entry_ownership (entry_id, author_id, request_fingerprint)
    values (p_id, p_author_id, p_fingerprint);
    return true;
  end if;

  return exists (
    select 1 from guestbook_private.entry_ownership
    where entry_id = p_id and author_id = p_author_id and request_fingerprint = p_fingerprint
  );
end;
$$;

create function public.register_guestbook_comment(
  p_id uuid, p_author_id uuid, p_fingerprint text,
  p_entry_id uuid, p_nickname text, p_body text
) returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  if p_author_id is null then
    raise exception 'An authenticated author is required' using errcode = '22004';
  end if;

  insert into public.comments (id, entry_id, nickname, body)
  values (p_id, p_entry_id, p_nickname, p_body)
  on conflict (id) do nothing;

  if found then
    insert into guestbook_private.comment_ownership (comment_id, author_id, request_fingerprint)
    values (p_id, p_author_id, p_fingerprint);
    return true;
  end if;

  return exists (
    select 1 from guestbook_private.comment_ownership
    where comment_id = p_id and author_id = p_author_id and request_fingerprint = p_fingerprint
  );
end;
$$;

revoke execute on function public.register_guestbook_entry(uuid, uuid, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.register_guestbook_comment(uuid, uuid, text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.register_guestbook_entry(uuid, uuid, text, text, text, text, text) to service_role;
grant execute on function public.register_guestbook_comment(uuid, uuid, text, uuid, text, text) to service_role;

-- Restrict this bucket even if another app has a permissive Storage policy.
create policy "Guestbook objects require server insert" on storage.objects
  as restrictive for insert to anon, authenticated
  with check (bucket_id <> 'moa-artwork');
create policy "Guestbook objects require server update" on storage.objects
  as restrictive for update to anon, authenticated
  using (bucket_id <> 'moa-artwork') with check (bucket_id <> 'moa-artwork');
create policy "Guestbook objects require server delete" on storage.objects
  as restrictive for delete to anon, authenticated
  using (bucket_id <> 'moa-artwork');

commit;
