create table if not exists public.wardrobe_items (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null check (length(name) between 1 and 32),
  category text not null check (category in ('top', 'bottom', 'outer', 'shoes', 'accessory')),
  color text not null check (color in ('black', 'white', 'gray', 'navy', 'blue', 'green', 'brown', 'red', 'pink', 'other')),
  warmth text not null check (warmth in ('light', 'medium', 'warm')),
  style text not null check (style in ('casual', 'smart', 'sport')),
  rain_safe boolean not null default false,
  image_path text not null check (image_path like user_id::text || '/%'),
  created_at timestamptz not null default now()
);

create index if not exists wardrobe_items_user_created_idx
  on public.wardrobe_items (user_id, created_at desc);

alter table public.wardrobe_items enable row level security;
grant select, insert, update, delete on public.wardrobe_items to authenticated;
revoke all on public.wardrobe_items from anon;

drop policy if exists wardrobe_owner on public.wardrobe_items;
create policy wardrobe_owner on public.wardrobe_items
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create table if not exists public.saved_outfits (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  item_ids uuid[] not null,
  purpose text not null check (purpose in ('daily', 'work', 'date', 'outdoor', 'sport')),
  temperature smallint not null,
  created_at timestamptz not null default now()
);

create index if not exists saved_outfits_user_created_idx
  on public.saved_outfits (user_id, created_at desc);

alter table public.saved_outfits enable row level security;
grant select, insert, update, delete on public.saved_outfits to authenticated;
revoke all on public.saved_outfits from anon;

drop policy if exists saved_outfits_owner on public.saved_outfits;
create policy saved_outfits_owner on public.saved_outfits
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wardrobe-images', 'wardrobe-images', false, 5242880, array['image/jpeg'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists wardrobe_images_owner on storage.objects;
create policy wardrobe_images_owner on storage.objects
  for all to authenticated
  using (
    bucket_id = 'wardrobe-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'wardrobe-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
