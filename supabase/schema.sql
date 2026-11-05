-- ============================================================
-- Sistema de Asistencia QR — I.E. Javier Heraud Pérez
-- Esquema para Supabase (PostgreSQL)
-- Ejecutar completo en: Supabase → SQL Editor → New query
-- ============================================================

create extension if not exists "uuid-ossp";

-- ------------------------------------------------------------
-- 1. PERFILES (docentes y estudiantes)
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('docente', 'estudiante')),
  grade text,
  email text unique,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 2. CLASES / SESIONES
-- ------------------------------------------------------------
create table if not exists public.classes (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  teacher_id uuid references public.profiles(id) on delete set null,
  grade text not null,
  section text,
  qr_code text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 3. ASISTENCIA
-- ------------------------------------------------------------
create table if not exists public.attendance (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  attended_at timestamptz not null default now(),
  status text not null default 'present' check (status in ('present', 'absent', 'late')),
  unique (student_id, class_id)
);

create index if not exists attendance_class_idx on public.attendance(class_id);
create index if not exists attendance_student_idx on public.attendance(student_id);
create index if not exists classes_qr_idx on public.classes(qr_code);
create index if not exists profiles_role_idx on public.profiles(role);

-- ------------------------------------------------------------
-- 4. CREAR PERFIL AUTOMÁTICAMENTE AL REGISTRARSE
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'estudiante'),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- 5. SEGURIDAD A NIVEL DE FILA (RLS)
-- ------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.attendance enable row level security;

-- Perfiles: todo usuario autenticado puede leer; cada uno edita el suyo
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Clases: lectura para autenticados; crea y edita solo el docente dueño
drop policy if exists "classes_select" on public.classes;
create policy "classes_select"
  on public.classes for select
  to authenticated
  using (true);

drop policy if exists "classes_insert_docente" on public.classes;
create policy "classes_insert_docente"
  on public.classes for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'docente'
    )
  );

drop policy if exists "classes_update_own" on public.classes;
create policy "classes_update_own"
  on public.classes for update
  to authenticated
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

-- Asistencia: lectura para autenticados; el estudiante registra la suya
drop policy if exists "attendance_select" on public.attendance;
create policy "attendance_select"
  on public.attendance for select
  to authenticated
  using (true);

drop policy if exists "attendance_insert_self" on public.attendance;
create policy "attendance_insert_self"
  on public.attendance for insert
  to authenticated
  with check (
    student_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'docente'
    )
  );

-- ------------------------------------------------------------
-- 6. (OPCIONAL) TIEMPO REAL PARA EL PANEL DEL DOCENTE
-- ------------------------------------------------------------
-- alter publication supabase_realtime add table public.attendance;

-- ============================================================
-- IMPORTANTE
-- En Supabase → Authentication → Providers → Email:
--   desactive "Confirm email" si desea que el registro
--   inicie sesión inmediatamente después de crear la cuenta.
-- ============================================================
