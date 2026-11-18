-- =====================================================================
-- Histórico por competência e ajuste de remuneração (2026-11-18, fatias 3 e 4 da aba Funcionários)
-- Desenho em docs/HISTORICO-DADOS.md. Idempotente: pode rodar de novo sem perder dados.
-- Depende de public.datasets, public.perfis, public.touch_updated(), public.is_aprovado() e public.is_admin().
-- =====================================================================

-- Uma linha por competência (mês/ano) importada do Cadastro funcional: de qual arquivo veio e quando.
-- competencia = primeiro dia do mês (2026-11-01 representa 11/2026).
create table if not exists public.historico_competencias (
  competencia date primary key
    check (extract(day from competencia) = 1 and competencia >= date '2000-01-01'),
  arquivo text not null check (pg_catalog.length(arquivo) between 1 and 255),
  importado_em timestamptz not null,
  total integer not null default 0 check (total >= 0),
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now()
);

-- Retrato de cada pessoa em cada competência. Minimização (LGPD): sem remuneração, alimentação, indicação ou CPF.
-- chave_identidade: 'm:<matrícula>' (comissionado) ou 'n:<nome normalizado>|<empresa normalizada>' (terceirizado
-- ou quem não tem matrícula); homônimos na mesma competência recebem sufixo '#2', '#3'... e possivel_duplicidade.
create table if not exists public.historico_retratos (
  id bigint generated always as identity primary key,
  competencia date not null references public.historico_competencias (competencia) on delete cascade,
  chave_identidade text not null
    check (chave_identidade ~ '^(m|n):.+' and pg_catalog.length(chave_identidade) <= 420),
  origem text not null check (origem in ('Comissionado', 'Terceirizado')),
  matricula text not null default '' check (pg_catalog.length(matricula) <= 40),
  nome text not null check (pg_catalog.length(nome) between 1 and 200),
  empresa_secretaria text not null default '' check (pg_catalog.length(empresa_secretaria) <= 200),
  funcao text not null default '' check (pg_catalog.length(funcao) <= 200),
  lotacao text not null default '' check (pg_catalog.length(lotacao) <= 200),
  possivel_duplicidade boolean not null default false,
  created_at timestamptz not null default now(),
  constraint historico_retratos_pessoa_competencia unique (competencia, chave_identidade)
);

-- O índice único (competencia, chave_identidade) cobre a FK e a leitura por competência;
-- este cobre o painel "Histórico do Funcionário" (uma pessoa, competências em ordem).
create index if not exists historico_retratos_pessoa_idx
  on public.historico_retratos (chave_identidade, competencia desc);

drop trigger if exists historico_competencias_touch on public.historico_competencias;
create trigger historico_competencias_touch before insert or update on public.historico_competencias
  for each row execute function public.touch_updated();

alter table public.historico_competencias enable row level security;
alter table public.historico_retratos enable row level security;
revoke all on public.historico_competencias, public.historico_retratos from anon, authenticated;
grant select, insert, update, delete on public.historico_competencias to authenticated;
grant select, insert, delete on public.historico_retratos to authenticated;

-- Mesma regra de datasets: aprovados leem; só administradores gravam ou apagam. Retrato não se edita: substitui-se.
drop policy if exists "aprovados leem historico_competencias" on public.historico_competencias;
drop policy if exists "admin insere historico_competencias" on public.historico_competencias;
drop policy if exists "admin altera historico_competencias" on public.historico_competencias;
drop policy if exists "admin apaga historico_competencias" on public.historico_competencias;
create policy "aprovados leem historico_competencias" on public.historico_competencias
  for select to authenticated using ((select public.is_aprovado()));
create policy "admin insere historico_competencias" on public.historico_competencias
  for insert to authenticated with check ((select public.is_admin()));
create policy "admin altera historico_competencias" on public.historico_competencias
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin apaga historico_competencias" on public.historico_competencias
  for delete to authenticated using ((select public.is_admin()));

drop policy if exists "aprovados leem historico_retratos" on public.historico_retratos;
drop policy if exists "admin insere historico_retratos" on public.historico_retratos;
drop policy if exists "admin apaga historico_retratos" on public.historico_retratos;
create policy "aprovados leem historico_retratos" on public.historico_retratos
  for select to authenticated using ((select public.is_aprovado()));
create policy "admin insere historico_retratos" on public.historico_retratos
  for insert to authenticated with check ((select public.is_admin()));
create policy "admin apaga historico_retratos" on public.historico_retratos
  for delete to authenticated using ((select public.is_admin()));

-- Substitui, numa única transação, o retrato de uma competência (reimportar a mesma competência é idempotente).
-- security invoker: roda com as permissões de quem chama, então a RLS acima continua valendo; a checagem de
-- administrador aqui só antecipa uma mensagem clara. p_retratos: array JSON com as chaves em snake_case.
create or replace function public.substituir_historico_competencia(
  p_competencia date,
  p_arquivo text,
  p_importado_em timestamptz,
  p_retratos jsonb
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_total integer;
begin
  if not public.is_admin() then
    raise exception 'Só administradores podem gravar o histórico.' using errcode = '42501';
  end if;
  if pg_catalog.pg_column_size(p_retratos) > 15000000 then
    raise exception 'Arquivo grande demais para o histórico.' using errcode = '22023';
  end if;
  if p_competencia is null or extract(day from p_competencia) <> 1 then
    raise exception 'Informe a competência (mês/ano) deste cadastro.' using errcode = '22023';
  end if;
  if p_competencia > (pg_catalog.date_trunc('month', pg_catalog.now() at time zone 'America/Sao_Paulo'))::date then
    raise exception 'A competência não pode ser posterior ao mês atual.' using errcode = '22023';
  end if;
  if p_retratos is null or pg_catalog.jsonb_typeof(p_retratos) <> 'array' then
    raise exception 'Lista de registros inválida.' using errcode = '22023';
  end if;
  v_total := pg_catalog.jsonb_array_length(p_retratos);
  if v_total > 50000 then
    raise exception 'Arquivo grande demais para o histórico.' using errcode = '22023';
  end if;

  insert into public.historico_competencias (competencia, arquivo, importado_em, total)
  values (p_competencia, p_arquivo, least(coalesce(p_importado_em, pg_catalog.now()), pg_catalog.now()), v_total)
  on conflict (competencia) do update
    set arquivo = excluded.arquivo, importado_em = excluded.importado_em, total = excluded.total;

  delete from public.historico_retratos where competencia = p_competencia;

  insert into public.historico_retratos
    (competencia, chave_identidade, origem, matricula, nome, empresa_secretaria, funcao, lotacao, possivel_duplicidade)
  select p_competencia, r.chave_identidade, r.origem, coalesce(r.matricula, ''), r.nome,
         coalesce(r.empresa_secretaria, ''), coalesce(r.funcao, ''), coalesce(r.lotacao, ''),
         coalesce(r.possivel_duplicidade, false)
  from pg_catalog.jsonb_to_recordset(p_retratos) as r(
    chave_identidade text, origem text, matricula text, nome text,
    empresa_secretaria text, funcao text, lotacao text, possivel_duplicidade boolean
  );

  return v_total;
end $$;

revoke all on function public.substituir_historico_competencia(date, text, timestamptz, jsonb) from public, anon;
grant execute on function public.substituir_historico_competencia(date, text, timestamptz, jsonb) to authenticated;

-- Ajuste de remuneração feito no sistema (R7). Registro de auditoria só de inclusão: cada alteração é uma linha nova;
-- o valor vigente é a linha mais recente de (importado_em, posicao). Vale só para a importação do Cadastro funcional
-- identificada por importado_em (= datasets.imported_at de kind 'planilha'): reimportar troca o imported_at e os
-- ajustes antigos deixam de valer (ficam como auditoria até "Limpar dados importados").
-- posicao = índice do registro em datasets.records (mesma convenção de public.indicacoes).
create table if not exists public.ajustes_remuneracao (
  id bigint generated always as identity primary key,
  importado_em timestamptz not null,
  posicao integer not null check (posicao >= 0),
  origem text not null check (origem in ('Comissionado', 'Terceirizado')),
  linha integer not null check (linha > 0),
  nome text not null default '' check (pg_catalog.length(nome) <= 200),
  valor_centavos bigint not null check (valor_centavos between 1 and 100000000),
  valor_anterior_centavos bigint check (valor_anterior_centavos is null or valor_anterior_centavos >= 0),
  alterado_por uuid default auth.uid() references auth.users (id) on delete set null,
  alterado_por_nome text not null default '' check (pg_catalog.length(alterado_por_nome) <= 200),
  alterado_em timestamptz not null default now()
);

create index if not exists ajustes_remuneracao_registro_idx
  on public.ajustes_remuneracao (importado_em, posicao, id desc);
create index if not exists ajustes_remuneracao_alterado_por_idx
  on public.ajustes_remuneracao (alterado_por);

-- Antes de gravar: confere que o registro existe na importação atual e preenche, sem confiar no navegador,
-- o nome do servidor, o valor anterior, quem alterou e quando.
create or replace function public.preparar_ajuste_remuneracao()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item jsonb;
  v_anterior bigint;
begin
  if not public.is_admin() then
    raise exception 'Só administradores podem alterar valores.' using errcode = '42501';
  end if;
  select d.records -> new.posicao into v_item
  from public.datasets d
  where d.kind = 'planilha' and d.imported_at = new.importado_em;
  if v_item is null then
    raise exception 'O cadastro funcional foi reimportado. Atualize a tela e tente de novo.' using errcode = '22023';
  end if;
  if (v_item ->> 'origem') is distinct from new.origem
     or (v_item ->> 'linha') is distinct from new.linha::text then
    raise exception 'Registro não encontrado no cadastro funcional atual.' using errcode = '22023';
  end if;

  select a.valor_centavos into v_anterior
  from public.ajustes_remuneracao a
  where a.importado_em = new.importado_em and a.posicao = new.posicao
  order by a.id desc
  limit 1;
  if not found then
    v_anterior := case
      when pg_catalog.jsonb_typeof(v_item -> 'remuneracao') = 'number'
        then pg_catalog.round((v_item ->> 'remuneracao')::numeric * 100)::bigint
    end;
  end if;

  new.nome := pg_catalog.left(coalesce(v_item ->> 'servidor', ''), 200);
  new.valor_anterior_centavos := v_anterior;
  new.alterado_por := auth.uid();
  new.alterado_em := pg_catalog.now();
  new.alterado_por_nome := coalesce((
    select pg_catalog.left(coalesce(nullif(p.nome, ''), p.email), 200)
    from public.perfis p where p.user_id = auth.uid()
  ), '');
  return new;
end $$;

drop trigger if exists ajustes_remuneracao_preparar on public.ajustes_remuneracao;
create trigger ajustes_remuneracao_preparar before insert on public.ajustes_remuneracao
  for each row execute function public.preparar_ajuste_remuneracao();

alter table public.ajustes_remuneracao enable row level security;
revoke all on public.ajustes_remuneracao from anon, authenticated;
grant select, insert, delete on public.ajustes_remuneracao to authenticated;

-- Aprovados veem o selo "Ajustado no sistema"; só administradores incluem; ninguém edita (auditoria);
-- administradores apagam apenas ao limpar os dados importados.
drop policy if exists "aprovados leem ajustes_remuneracao" on public.ajustes_remuneracao;
drop policy if exists "admin insere ajustes_remuneracao" on public.ajustes_remuneracao;
drop policy if exists "admin apaga ajustes_remuneracao" on public.ajustes_remuneracao;
create policy "aprovados leem ajustes_remuneracao" on public.ajustes_remuneracao
  for select to authenticated using ((select public.is_aprovado()));
create policy "admin insere ajustes_remuneracao" on public.ajustes_remuneracao
  for insert to authenticated with check ((select public.is_admin()));
create policy "admin apaga ajustes_remuneracao" on public.ajustes_remuneracao
  for delete to authenticated using ((select public.is_admin()));
