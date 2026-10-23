-- ================================================================
-- ÑanGO · Esquema de Supabase (versión corregida)
-- -----------------------------------------------------------------
-- Cómo usarlo:
--   1. Entra a tu proyecto en https://supabase.com
--   2. Menú lateral: SQL Editor → New query
--   3. Pega TODO este archivo y pulsa "Run".
-- Es seguro volver a ejecutarlo (usa IF NOT EXISTS / OR REPLACE / DROP … IF EXISTS)
-- y también funciona si ya tenías tablas creadas (agrega lo que falte).
-- ================================================================

-- ================================================================
-- 1. CREAR TABLAS
-- ================================================================

-- PROFILES
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text,
  terms_version text,                                   -- versión de términos aceptada (null = pendiente)
  favorite_lines jsonb not null default '[]'::jsonb,    -- ['linea-60', …]
  shortcuts      jsonb not null default '[]'::jsonb,    -- [{ id, label, icon, place }, …]
  history        jsonb not null default '[]'::jsonb,    -- [{ o, d, lineaId, when, ts }, …]
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists trips jsonb not null default '[]'::jsonb;  -- historial de viajes: [{ lineaId, lineas, duracion, fecha, … }, …]

-- ALERTS
create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,  -- null en los avisos de ejemplo
  tipo text not null,                -- desvio | trafico | paro | accidente | lluvia | tarifa
  linea_id text not null,            -- 'linea-60', 'linea-15', 'linea-20mayo'…
  donde text,
  titulo text not null,
  texto text,
  base int not null default 0,       -- confirmaciones de partida (para los ejemplos)
  confirmaciones int not null default 1,
  rechazos int not null default 0,
  estado text not null default 'pendiente',  -- pendiente | publicado | invalido
  created_at timestamptz not null default now()
);

-- ALERT VOTES
create table if not exists public.alert_votes (
  alert_id uuid not null references public.alerts(id) on delete cascade,
  user_id  uuid not null references auth.users(id) on delete cascade,
  voto text not null check (voto in ('yes','no')),
  updated_at timestamptz not null default now(),
  primary key (alert_id, user_id)
);

-- ================================================================
-- 2. AÑADIR COLUMNAS FALTANTES (por si las tablas ya existían)
-- ================================================================

alter table public.profiles add column if not exists nombre text;
alter table public.profiles add column if not exists terms_version text;
alter table public.profiles add column if not exists favorite_lines jsonb not null default '[]'::jsonb;
alter table public.profiles add column if not exists shortcuts jsonb not null default '[]'::jsonb;
alter table public.profiles add column if not exists history jsonb not null default '[]'::jsonb;
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

alter table public.alerts add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.alerts add column if not exists donde text;
alter table public.alerts add column if not exists texto text;
alter table public.alerts add column if not exists base int not null default 0;
alter table public.alerts add column if not exists confirmaciones int not null default 1;
alter table public.alerts add column if not exists rechazos int not null default 0;
alter table public.alerts add column if not exists estado text not null default 'pendiente';
alter table public.alerts add column if not exists created_at timestamptz not null default now();
alter table public.alerts add column if not exists expira_at timestamptz;   -- cuándo deja de mostrarse (null = no vence, como los ejemplos)

-- Bases creadas con una versión anterior: la columna del voto se llamaba "vote" y ahora es "voto".
-- Se renombra solo si hace falta (los votos que ya existían se conservan).
do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'alert_votes' and column_name = 'vote')
     and not exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'alert_votes' and column_name = 'voto') then
    alter table public.alert_votes rename column vote to voto;
  end if;
end $$;

alter table public.alert_votes add column if not exists updated_at timestamptz not null default now();

-- ================================================================
-- 3. ROW LEVEL SECURITY Y POLÍTICAS
-- ================================================================

-- PROFILES
alter table public.profiles enable row level security;

drop policy if exists "perfil: leer el mio" on public.profiles;
create policy "perfil: leer el mio" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "perfil: insertar el mio" on public.profiles;
create policy "perfil: insertar el mio" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "perfil: actualizar el mio" on public.profiles;
create policy "perfil: actualizar el mio" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- ALERTS
alter table public.alerts enable row level security;

drop policy if exists "avisos: leer todos" on public.alerts;
create policy "avisos: leer todos" on public.alerts
  for select using (true);

drop policy if exists "avisos: crear el mio" on public.alerts;
create policy "avisos: crear el mio" on public.alerts
  for insert with check (auth.uid() = user_id);

drop policy if exists "avisos: editar el mio" on public.alerts;
create policy "avisos: editar el mio" on public.alerts
  for update using (auth.uid() = user_id);

-- ALERT_VOTES
alter table public.alert_votes enable row level security;

drop policy if exists "votos: leer todos" on public.alert_votes;
create policy "votos: leer todos" on public.alert_votes
  for select using (true);

drop policy if exists "votos: crear el mio" on public.alert_votes;
create policy "votos: crear el mio" on public.alert_votes
  for insert with check (auth.uid() = user_id);

drop policy if exists "votos: actualizar el mio" on public.alert_votes;
create policy "votos: actualizar el mio" on public.alert_votes
  for update using (auth.uid() = user_id);

drop policy if exists "votos: borrar el mio" on public.alert_votes;
create policy "votos: borrar el mio" on public.alert_votes
  for delete using (auth.uid() = user_id);

-- ================================================================
-- 4. FUNCIONES Y TRIGGERS
-- ================================================================

-- Crear perfil al registrarse
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nombre)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Aceptar términos
create or replace function public.accept_terms(p_version text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
     set terms_version = p_version, updated_at = now()
   where id = auth.uid();
$$;

-- Eliminar cuenta
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.profiles where id = auth.uid();
  delete from auth.users where id = auth.uid();
end;
$$;

-- Votar aviso
create or replace function public.votar_aviso(p_alert uuid, p_voto text)
returns public.alerts
language plpgsql
security definer
set search_path = public
as $$
declare
  u uuid := auth.uid();
  prev text;
  a public.alerts;
begin
  if u is null then raise exception 'Necesitas una cuenta para votar.'; end if;
  if p_voto not in ('yes','no') then raise exception 'Voto invalido.'; end if;

  select voto into prev from public.alert_votes where alert_id = p_alert and user_id = u;
  if prev = p_voto then
    delete from public.alert_votes where alert_id = p_alert and user_id = u;
  elsif prev is null then
    insert into public.alert_votes (alert_id, user_id, voto) values (p_alert, u, p_voto);
  else
    update public.alert_votes set voto = p_voto, updated_at = now()
     where alert_id = p_alert and user_id = u;
  end if;

  select * into a from public.alerts where id = p_alert;
  return a;
end;
$$;

-- ----------------------------------------------------------------
-- VIGENCIA DE LOS AVISOS: cuántas horas dura cada tipo.
-- Para cambiar un tiempo: Table Editor → alert_vigencia → edita la columna "horas"
-- (o en el SQL Editor:  update public.alert_vigencia set horas = 4 where tipo = 'trafico';)
-- El cambio vale para los avisos NUEVOS; los que ya existen conservan su vencimiento.
--   horas       = cuánto dura el aviso una vez publicado (contado desde que se creó)
--   extra_horas = cuánto se alarga cuando alguien lo confirma de nuevo
--   fila 'pendiente' = cuánto dura un aviso que nadie ha confirmado todavía
-- ----------------------------------------------------------------
create table if not exists public.alert_vigencia (
  tipo text primary key,               -- desvio | trafico | paro | accidente | lluvia | tarifa | pendiente
  horas int not null check (horas > 0),
  extra_horas int not null default 2 check (extra_horas >= 0)
);
insert into public.alert_vigencia (tipo, horas, extra_horas) values
  ('trafico',   3, 2),
  ('accidente', 4, 2),
  ('lluvia',    6, 2),
  ('paro',     24, 2),
  ('desvio',   48, 2),
  ('tarifa',  168, 2),
  ('pendiente', 2, 0)
on conflict (tipo) do nothing;         -- no pisa los tiempos que ya hayas cambiado
alter table public.alert_vigencia enable row level security;   -- sin políticas: solo se edita desde el panel

-- Al crear un aviso nuevo se fija cuándo vence; nadie (salvo el servidor) puede cambiarlo después.
create or replace function public.fijar_vencimiento_aviso()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_horas int;
begin
  if tg_op = 'INSERT' then
    if new.user_id is not null then                -- los avisos de ejemplo (sin usuario) no vencen
      select horas into v_horas from public.alert_vigencia where tipo = 'pendiente';
      new.expira_at := now() + make_interval(hours => coalesce(v_horas, 2));
    end if;
  elsif new.expira_at is distinct from old.expira_at and current_user in ('anon', 'authenticated') then
    new.expira_at := old.expira_at;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_vencimiento_aviso on public.alerts;
create trigger trg_vencimiento_aviso
  before insert or update on public.alerts
  for each row execute function public.fijar_vencimiento_aviso();

-- Los avisos de personas que ya existían reciben su vencimiento según su tipo.
update public.alerts a
   set expira_at = a.created_at + make_interval(hours => coalesce(
         (select v.horas from public.alert_vigencia v where v.tipo = a.tipo), 24))
 where a.expira_at is null and a.user_id is not null;

-- LÍMITE DE AVISOS POR PERSONA (contra el spam): máximo 5 por hora y 20 por día, y no repetir el
-- mismo tipo en la misma línea en 30 minutos. La app muestra un mensaje y descarta el aviso rechazado.
-- Para cambiar los topes edita los números de abajo (y LIMITE_POR_HORA en js/services/alerts.service.js).
-- ----------------------------------------------------------------
create index if not exists alerts_user_created_idx on public.alerts (user_id, created_at desc);

create or replace function public.limitar_reportes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.user_id is null then return new; end if;
  if (select count(*) from public.alerts
       where user_id = new.user_id and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'limite-reportes: máximo 5 avisos por hora';
  end if;
  if (select count(*) from public.alerts
       where user_id = new.user_id and created_at > now() - interval '1 day') >= 20 then
    raise exception 'limite-reportes: máximo 20 avisos por día';
  end if;
  if exists (select 1 from public.alerts
              where user_id = new.user_id and tipo = new.tipo and linea_id = new.linea_id
                and created_at > now() - interval '30 minutes') then
    raise exception 'aviso-duplicado: ya reportaste esto hace poco';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_limite_reportes on public.alerts;
create trigger trg_limite_reportes
  before insert on public.alerts
  for each row execute function public.limitar_reportes();

-- Recalcular aviso tras votar (estado, confirmaciones y vencimiento)
create or replace function public.recalcular_aviso()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  aid uuid := coalesce(new.alert_id, old.alert_id);
  v_si int; v_no int; v_base int; v_estado text; v_conf_antes int; v_tipo text; v_creado timestamptz;
  v_conf int; v_nuevo text; v_horas int; v_extra int;
begin
  select count(*) filter (where voto = 'yes'), count(*) filter (where voto = 'no')
    into v_si, v_no
    from public.alert_votes where alert_id = aid;

  select a.base, a.estado, a.confirmaciones, a.tipo, a.created_at
    into v_base, v_estado, v_conf_antes, v_tipo, v_creado
    from public.alerts a where a.id = aid;
  if not found then return null; end if;            -- el aviso ya se borró

  v_conf := v_base + 1 + v_si;

  if v_estado = 'invalido' then
    update public.alerts set confirmaciones = v_conf, rechazos = v_no where id = aid;
    return null;
  end if;

  v_nuevo := case
               when v_no >= 5 then 'invalido'
               when v_conf >= 2 then 'publicado'
               else 'pendiente'
             end;

  select v.horas, v.extra_horas into v_horas, v_extra
    from public.alert_vigencia v where v.tipo = v_tipo;
  v_horas := coalesce(v_horas, 24);
  v_extra := coalesce(v_extra, 2);

  update public.alerts set
    confirmaciones = v_conf,
    rechazos = v_no,
    estado = v_nuevo,
    expira_at = case
      when expira_at is null then null                                   -- los ejemplos no vencen
      when v_nuevo <> 'publicado' then expira_at
      when v_estado <> 'publicado'                                       -- acaba de publicarse
        then greatest(expira_at, v_creado + make_interval(hours => v_horas))
      when v_conf > v_conf_antes                                         -- alguien lo confirmó otra vez
        then greatest(expira_at, now() + make_interval(hours => v_extra))
      else expira_at
    end
  where id = aid;
  return null;
end;
$$;

drop trigger if exists trg_recalcular_aviso on public.alert_votes;
create trigger trg_recalcular_aviso
  after insert or update or delete on public.alert_votes
  for each row execute function public.recalcular_aviso();

-- Limpieza: borra los avisos que vencieron hace más de 30 días (opcional, no afecta lo que se ve en la app).
create or replace function public.limpiar_avisos_vencidos()
returns int
language sql
security definer
set search_path = public
as $$
  with borrados as (
    delete from public.alerts where expira_at < now() - interval '30 days' returning 1
  )
  select count(*)::int from borrados;
$$;
revoke all on function public.limpiar_avisos_vencidos() from public, anon, authenticated;
-- Para que se ejecute sola cada día: activa la extensión pg_cron (Database → Extensions) y corre:
--   select cron.schedule('limpiar-avisos', '0 4 * * *', 'select public.limpiar_avisos_vencidos()');

-- ----------------------------------------------------------------
-- ESTADÍSTICAS DEL PERFIL: cuántos avisos publicó la persona y cuántas personas distintas los confirmaron.
-- Es una función (y no una consulta directa) para que cada cuenta vea solo lo suyo sin abrir la lectura de
-- los votos de las demás. Solo la pueden ejecutar cuentas con sesión.
-- ----------------------------------------------------------------
create or replace function public.mis_estadisticas()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    -- avisos que creó (los que la comunidad dio de baja como inválidos no cuentan)
    'avisos', (select count(*) from public.alerts a
                where a.user_id = auth.uid() and a.estado <> 'invalido'),
    -- personas distintas, aparte de ella misma, que confirmaron alguno de sus avisos
    'confirmaron', (select count(distinct v.user_id)
                      from public.alert_votes v
                      join public.alerts a on a.id = v.alert_id
                     where a.user_id = auth.uid() and v.voto = 'yes' and v.user_id <> auth.uid())
  );
$$;
revoke all on function public.mis_estadisticas() from public, anon;
grant execute on function public.mis_estadisticas() to authenticated;

-- ================================================================
-- 5. PERMISOS (GRANT)
-- ================================================================

grant usage on schema public to anon, authenticated;

grant select on public.alerts to anon, authenticated;
grant insert, update on public.alerts to authenticated;

grant select on public.alert_votes to anon, authenticated;
grant insert, update, delete on public.alert_votes to authenticated;

grant select, insert, update on public.profiles to authenticated;

grant execute on function public.accept_terms(text) to authenticated;
grant execute on function public.delete_my_account() to authenticated;
grant execute on function public.votar_aviso(uuid, text) to authenticated;

-- ================================================================
-- LIMPIEZA (una sola vez, si ya habías insertado los avisos de ejemplo):
--   delete from public.alerts where user_id is null;
-- ================================================================
