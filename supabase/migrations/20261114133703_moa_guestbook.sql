create table public.entries (
  id uuid primary key,
  nickname text not null check (char_length(nickname) between 1 and 24),
  message text not null default '' check (char_length(message) <= 160),
  image_path text not null,
  image_type text not null check (image_type in ('photo', 'drawing')),
  created_at timestamptz not null default now()
);

create table public.comments (
  id uuid primary key,
  entry_id uuid not null references public.entries(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 24),
  body text not null check (char_length(btrim(body)) between 1 and 300),
  created_at timestamptz not null default now()
);

create index entries_recent_idx on public.entries (created_at desc, id desc);
create index comments_entry_time_idx on public.comments (entry_id, created_at, id);

alter table public.entries enable row level security;
alter table public.comments enable row level security;
revoke all on public.entries, public.comments from public, anon, authenticated;
grant select on public.entries, public.comments to anon, authenticated;
grant select, insert, update, delete on public.entries, public.comments to service_role;
create policy "Read published entries" on public.entries for select to anon, authenticated using (true);
create policy "Read published comments" on public.comments for select to anon, authenticated using (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('moa-artwork', 'moa-artwork', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']);

alter publication supabase_realtime add table public.entries, public.comments;
