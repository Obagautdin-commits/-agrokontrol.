-- AgroKontrol v1 — выполнять целиком в Supabase SQL Editor один раз.
-- ВНИМАНИЕ: файл не создаёт пользователей. Создайте их в Authentication -> Users
-- и добавьте строки в public.profiles по инструкции README.md.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Сотрудник',
  role text not null check (role in ('admin','agronomist')),
  created_at timestamptz not null default now()
);

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()));
$$;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin');
$$;

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(trim(full_name)) >= 2),
  district text not null default '',
  settlement text not null default '',
  address text not null default '',
  phone text not null default '',
  area_m2 numeric(12,2) not null check (area_m2 > 0),
  rate_per_m2 numeric(12,2) not null check (rate_per_m2 >= 0),
  visits_per_month integer not null default 4 check (visits_per_month between 1 and 20),
  preferred_days text not null default '',
  notes text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.charges (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  type text not null check (type in ('monthly','debt')),
  billing_month date not null,
  title text not null default '',
  amount numeric(14,2) not null check (amount > 0),
  area_snapshot numeric(12,2),
  rate_snapshot numeric(12,2),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  constraint monthly_snapshots check (
    type <> 'monthly' or (area_snapshot is not null and rate_snapshot is not null)
  )
);
create unique index if not exists one_monthly_charge_per_client
on public.charges (client_id,billing_month) where type='monthly';
create index if not exists charges_client_idx on public.charges(client_id,billing_month);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  charge_id uuid not null references public.charges(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  method text not null check (method in ('cash','bank')),
  paid_at date not null default current_date,
  note text not null default '',
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists payments_charge_idx on public.payments(charge_id);
create index if not exists payments_date_idx on public.payments(paid_at);

-- Не даём записать оплату больше начисления, даже с двух устройств одновременно.
create or replace function public.validate_payment() returns trigger
language plpgsql security definer set search_path = public as $$
declare max_amount numeric; total numeric;
begin
  select amount into max_amount from public.charges where id = new.charge_id for update;
  if max_amount is null then raise exception 'Начисление не найдено'; end if;
  select coalesce(sum(amount),0) into total from public.payments
  where charge_id=new.charge_id and id is distinct from new.id;
  if total + new.amount > max_amount then
    raise exception 'Сумма оплат превышает начисление. Остаток: %', max_amount-total;
  end if;
  return new;
end; $$;
drop trigger if exists payments_limit on public.payments;
create trigger payments_limit before insert or update of amount,charge_id on public.payments
for each row execute function public.validate_payment();

create or replace function public.validate_charge() returns trigger
language plpgsql security definer set search_path = public as $$
declare paid numeric;
begin
  if new.amount <> old.amount then
    select coalesce(sum(amount),0) into paid from public.payments where charge_id=new.id;
    if new.amount < paid then raise exception 'Начисление не может быть меньше внесённых оплат'; end if;
  end if;
  return new;
end; $$;
drop trigger if exists charges_limit on public.charges;
create trigger charges_limit before update of amount on public.charges
for each row execute function public.validate_charge();

create table if not exists public.visits (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  visit_date date not null,
  start_time time without time zone not null,
  duration_minutes integer not null default 20 check (duration_minutes between 5 and 300),
  status text not null default 'scheduled' check (status in ('scheduled','completed','cancelled')),
  consultation boolean not null default false,
  notes text not null default '',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);
create index if not exists visits_date_idx on public.visits(visit_date,start_time);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  spent_at date not null default current_date,
  amount numeric(14,2) not null check (amount > 0),
  category text not null default 'Прочее',
  note text not null default '',
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  action text not null,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  actor_id uuid,
  changed_at timestamptz not null default now()
);
create index if not exists audit_date_idx on public.audit_log(changed_at desc);

create or replace function public.record_audit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log(table_name,action,record_id,old_data,new_data,actor_id)
  values (tg_table_name, tg_op,
    case when tg_op='DELETE' then old.id else new.id end,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('UPDATE','INSERT') then to_jsonb(new) else null end,
    auth.uid());
  return coalesce(new,old);
end; $$;
do $$
declare t text;
begin
  foreach t in array array['clients','charges','payments','visits','expenses'] loop
    execute format('drop trigger if exists %I on public.%I', 'audit_'||t, t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.record_audit()', 'audit_'||t, t);
  end loop;
end $$;

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.charges enable row level security;
alter table public.payments enable row level security;
alter table public.visits enable row level security;
alter table public.expenses enable row level security;
alter table public.audit_log enable row level security;

-- Политики можно пересоздать повторным запуском файла.
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (public.is_staff());
drop policy if exists profiles_write on public.profiles;
create policy profiles_write on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists clients_read on public.clients;
create policy clients_read on public.clients for select to authenticated using (public.is_staff());
drop policy if exists clients_write on public.clients;
create policy clients_write on public.clients for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists charges_read on public.charges;
create policy charges_read on public.charges for select to authenticated using (public.is_staff());
drop policy if exists charges_write on public.charges;
create policy charges_write on public.charges for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists payments_read on public.payments;
create policy payments_read on public.payments for select to authenticated using (public.is_staff());
drop policy if exists payments_write on public.payments;
create policy payments_write on public.payments for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists visits_read on public.visits;
create policy visits_read on public.visits for select to authenticated using (public.is_staff());
drop policy if exists visits_write on public.visits;
create policy visits_write on public.visits for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists expenses_read on public.expenses;
create policy expenses_read on public.expenses for select to authenticated using (public.is_staff());
drop policy if exists expenses_write on public.expenses;
create policy expenses_write on public.expenses for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists audit_read on public.audit_log;
create policy audit_read on public.audit_log for select to authenticated using (public.is_admin());

-- Для таблицы аудита нет пользовательской политики INSERT/UPDATE/DELETE:
-- записи создаются только триггером с правами владельца.
-- Не отключайте RLS и не помещайте service_role / secret key во фронтенд.

-- Явные права на Data API. Политики RLS продолжают ограничивать все действия.
grant usage on schema public to authenticated;
grant select,insert,update,delete on public.profiles,public.clients,public.charges,
  public.payments,public.visits,public.expenses to authenticated;
grant select on public.audit_log to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_admin() to authenticated;

create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin new.updated_at=now(); return new; end; $$;
drop trigger if exists clients_touch_updated_at on public.clients;
create trigger clients_touch_updated_at before update on public.clients
for each row execute function public.touch_updated_at();
