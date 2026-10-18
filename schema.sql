-- Rotina Atípica: esquema do banco (Supabase / Postgres)
-- Rode no SQL Editor do Supabase. Todas as tabelas têm RLS: cada mãe só vê os próprios dados.

begin;

-- 1. Perfil da responsável (1 linha por usuária do auth.users)
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  nome          text not null,
  email         text not null,
  role          text not null default 'user' check (role in ('user','admin')),
  trial_ends_at timestamptz not null default (now() + interval '7 days'),
  aceite_termos_em timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

-- 2. Crianças (mínimo de dados: só nome/apelido e gênero gramatical dos textos)
create table public.criancas (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  nome       text not null,
  genero     text not null default 'm' check (genero in ('m','f')),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

-- 3. Cartões (pictograma ARASAAC, emoji ou foto própria + voz gravada)
create table public.cartoes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  titulo        text not null,
  arasaac_id    integer,          -- id do pictograma ARASAAC, quando usado
  imagem_path   text,             -- foto própria no Storage (bucket "midia")
  audio_path    text,             -- voz da mãe no Storage (bucket "midia")
  created_at    timestamptz not null default now(),
  unique (id, user_id)
);

-- 4. Quadros: rotina, espera, sentimentos, escala
create table public.quadros (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  crianca_id uuid not null,
  tipo       text not null check (tipo in ('rotina','espera','sentimentos','escala')),
  nome       text not null,
  config     jsonb not null default '{}'::jsonb,  -- estado do quadro: rotina, timer, sentimentos e escala
  created_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (crianca_id, user_id) references public.criancas(id, user_id) on delete cascade
);

-- 5. Itens de cada quadro (ordem + checklist do dia)
create table public.quadro_itens (
  id         uuid primary key default gen_random_uuid(),
  quadro_id  uuid not null,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  cartao_id  uuid not null,
  ordem      integer not null default 0,
  feito_em   date,                -- data em que foi marcado como feito (checklist)
  nivel      smallint check (nivel between 1 and 5),  -- usado na escala
  foreign key (quadro_id, user_id) references public.quadros(id, user_id) on delete cascade,
  foreign key (cartao_id, user_id) references public.cartoes(id, user_id) on delete cascade
);

-- 6. Assinaturas (atualizadas pelo webhook do Mercado Pago)
create table public.assinaturas (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles(id) on delete cascade,
  plano             text not null check (plano in ('mensal','anual')),
  status            text not null check (status in ('pendente','ativa','pausada','cancelada','atrasada')),
  valor_centavos    integer not null,          -- 1490 ou 11990
  mp_preapproval_id text unique,               -- id da assinatura no Mercado Pago
  periodo_fim       timestamptz,               -- acesso vale até aqui
  cancelada_em      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Evita que requisições simultâneas iniciem assinaturas concorrentes para a mesma conta.
create unique index assinaturas_uma_corrente_por_usuario
  on public.assinaturas (user_id)
  where status in ('pendente','ativa','pausada');

-- 7. Pagamentos recebidos (para faturamento do mês no painel admin)
create table public.pagamentos (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  assinatura_id  uuid references public.assinaturas(id) on delete set null,
  mp_payment_id  text unique not null,
  valor_centavos integer not null,
  status         text not null,
  pago_em        timestamptz not null default now()
);

-- Cria o perfil automaticamente no cadastro
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nome, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome',''), new.email);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Quem é admin?
create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Tem acesso? (teste grátis válido ou assinatura ativa)
create function public.tem_acesso(uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  select (uid = auth.uid() or public.is_admin())
      and (exists (select 1 from public.profiles p where p.id = uid and p.trial_ends_at > now())
      or exists (select 1 from public.assinaturas a where a.user_id = uid
                 and a.status = 'ativa' and a.periodo_fim > now()));
$$;

-- RLS
alter table public.profiles     enable row level security;
alter table public.criancas     enable row level security;
alter table public.cartoes      enable row level security;
alter table public.quadros      enable row level security;
alter table public.quadro_itens enable row level security;
alter table public.assinaturas  enable row level security;
alter table public.pagamentos   enable row level security;

-- Perfil: a própria usuária lê e edita (sem poder mudar role/trial); admin lê todos
create policy "perfil proprio leitura" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "perfil proprio edicao" on public.profiles for update using (id = auth.uid())
  with check (id = auth.uid());

-- Dados da criança e dos quadros: só a dona, e só com acesso liberado para escrever
create policy "criancas dona" on public.criancas for select using (user_id = auth.uid());
create policy "criancas escrita" on public.criancas for all using (user_id = auth.uid() and public.tem_acesso()) with check (user_id = auth.uid() and public.tem_acesso());
create policy "cartoes dona" on public.cartoes for select using (user_id = auth.uid());
create policy "cartoes escrita" on public.cartoes for all using (user_id = auth.uid() and public.tem_acesso()) with check (user_id = auth.uid() and public.tem_acesso());
create policy "quadros dona" on public.quadros for select using (user_id = auth.uid());
create policy "quadros escrita" on public.quadros for all using (user_id = auth.uid() and public.tem_acesso()) with check (user_id = auth.uid() and public.tem_acesso());
create policy "itens dona" on public.quadro_itens for select using (user_id = auth.uid());
create policy "itens escrita" on public.quadro_itens for all using (user_id = auth.uid() and public.tem_acesso()) with check (user_id = auth.uid() and public.tem_acesso());

-- Assinaturas e pagamentos: usuária só lê os seus; só o webhook (service role) escreve
create policy "assinaturas leitura" on public.assinaturas for select using (user_id = auth.uid() or public.is_admin());
create policy "pagamentos leitura" on public.pagamentos for select using (user_id = auth.uid() or public.is_admin());

-- Storage: bucket privado "midia", arquivos em midia/<user_id>/...
insert into storage.buckets (id, name, public) values ('midia','midia', false) on conflict do nothing;
create policy "midia dona" on storage.objects for all to authenticated
  using (bucket_id = 'midia' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'midia' and (storage.foldername(name))[1] = auth.uid()::text);

-- Painel admin (só admin consegue ler; a função barra quem não é admin)
create function public.admin_resumo() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'acesso negado'; end if;
  return json_build_object(
    'total_usuarias',  (select count(*) from profiles),
    'em_teste',        (select count(*) from profiles p where p.trial_ends_at > now()
                          and not exists (select 1 from assinaturas a where a.user_id = p.id and a.status = 'ativa')),
    'mensal',          (select count(*) from assinaturas where status = 'ativa' and plano = 'mensal'),
    'anual',           (select count(*) from assinaturas where status = 'ativa' and plano = 'anual'),
    'cancelamentos_mes', (select count(*) from assinaturas where cancelada_em >= date_trunc('month', now())),
    'novas_hoje',      (select count(*) from profiles where created_at >= date_trunc('day', now())),
    'novas_mes',       (select count(*) from profiles where created_at >= date_trunc('month', now())),
    'faturamento_mes_centavos', (select coalesce(sum(valor_centavos),0) from pagamentos
                          where status = 'approved' and pago_em >= date_trunc('month', now()))
  );
end $$;

create view public.admin_usuarias with (security_invoker = true) as
  select p.id, p.nome, p.email, p.created_at, p.trial_ends_at,
         a.plano, coalesce(a.status, case when p.trial_ends_at > now() then 'teste' else 'teste encerrado' end) as status
  from profiles p
  left join lateral (select plano, status from assinaturas where user_id = p.id order by created_at desc limit 1) a on true;
-- security_invoker: a view respeita o RLS, então só o admin enxerga todas as linhas.

-- Permissões explícitas para a Data API; RLS continua controlando cada linha.
revoke all on public.profiles, public.criancas, public.cartoes, public.quadros,
  public.quadro_itens, public.assinaturas, public.pagamentos from anon, authenticated;
revoke all on public.admin_usuarias from public, anon, authenticated;
grant select on public.profiles, public.assinaturas, public.pagamentos to authenticated;
grant update (nome) on public.profiles to authenticated;
grant select, insert, update, delete on public.criancas, public.cartoes, public.quadros,
  public.quadro_itens to authenticated;
grant select on public.admin_usuarias to authenticated;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.is_admin() from public, anon;
revoke all on function public.tem_acesso(uuid) from public, anon;
revoke all on function public.admin_resumo() from public, anon;
grant execute on function public.is_admin(), public.tem_acesso(uuid),
  public.admin_resumo() to authenticated;

-- Depois de criar sua conta, torne-se admin (troque o e-mail):
-- update public.profiles set role = 'admin' where email = 'seu-email@exemplo.com';

commit;
