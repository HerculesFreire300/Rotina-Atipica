begin;

insert into storage.buckets (id, name, public)
values ('audio-padrao', 'audio-padrao', true)
on conflict (id) do update set public = true;

drop policy if exists "audios padrao publicos para leitura" on storage.objects;
create policy "audios padrao publicos para leitura" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'audio-padrao');

commit;
