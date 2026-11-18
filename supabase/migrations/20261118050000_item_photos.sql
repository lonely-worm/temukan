-- Create bucket for item photos and add photo_path column to items.
-- Upload is handled server-side via service role to keep policy simple.

insert into storage.buckets (id, name, public)
values ('item-photos', 'item-photos', true)
on conflict (id) do nothing;

alter table public.lost_items add column if not exists photo_path text;
alter table public.found_items add column if not exists photo_path text;

-- Public read access for photos (bucket is public).
create policy "public read item photos" on storage.objects
for select to anon, authenticated using (bucket_id = 'item-photos');
