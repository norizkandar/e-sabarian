
-- =====================================================
-- SCHOOL FACE ATTENDANCE SYSTEM
-- Database setup for Supabase
-- Prefix: sfa_
-- =====================================================

create extension if not exists pgcrypto;

-- 1. STAFF AND USER PROFILES
create table if not exists public.sfa_profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    display_name text not null default '',
    role text not null default 'student'
        check (role in ('admin', 'teacher', 'parent', 'student')),
    created_at timestamptz not null default now()
);

-- 2. STUDENT RECORDS
create table if not exists public.sfa_students (
    id uuid primary key default gen_random_uuid(),
    student_code text not null unique,
    full_name text not null,
    class_name text not null default '',
    active boolean not null default true,
    created_at timestamptz not null default now()
);

-- 3. DAILY ATTENDANCE
create table if not exists public.sfa_attendance (
    id uuid primary key default gen_random_uuid(),
    student_id uuid not null
        references public.sfa_students(id) on delete restrict,
    attendance_date date not null default
        (timezone('Asia/Kuala_Lumpur', now())::date),
    status text not null
        check (status in ('present', 'late', 'absent')),
    marked_by uuid references public.sfa_profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    unique (student_id, attendance_date)
);

-- =====================================================
-- 4. ROLE HELPER
-- SECURITY DEFINER avoids recursive profile-policy checks.
-- =====================================================

create or replace function public.sfa_current_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
    select p.role
    from public.sfa_profiles as p
    where p.id = (select auth.uid())
    limit 1;
$$;

revoke all on function public.sfa_current_role() from public;
grant execute on function public.sfa_current_role() to authenticated;

-- =====================================================
-- 5. ENABLE ROW LEVEL SECURITY
-- =====================================================

alter table public.sfa_profiles enable row level security;
alter table public.sfa_students enable row level security;
alter table public.sfa_attendance enable row level security;

-- =====================================================
-- 6. PROFILE POLICIES
-- Users can view their own profile.
-- Admins and teachers can view profiles for staff workflows.
-- Only admins can change profiles.
-- =====================================================

drop policy if exists "sfa_profiles_select" on public.sfa_profiles;
create policy "sfa_profiles_select"
on public.sfa_profiles
for select to authenticated
using (
    id = (select auth.uid())
    or (select public.sfa_current_role()) in ('admin', 'teacher')
);

drop policy if exists "sfa_profiles_admin_insert" on public.sfa_profiles;
create policy "sfa_profiles_admin_insert"
on public.sfa_profiles
for insert to authenticated
with check (
    (select public.sfa_current_role()) = 'admin'
);

drop policy if exists "sfa_profiles_admin_update" on public.sfa_profiles;
create policy "sfa_profiles_admin_update"
on public.sfa_profiles
for update to authenticated
using (
    (select public.sfa_current_role()) = 'admin'
)
with check (
    (select public.sfa_current_role()) = 'admin'
);

drop policy if exists "sfa_profiles_admin_delete" on public.sfa_profiles;
create policy "sfa_profiles_admin_delete"
on public.sfa_profiles
for delete to authenticated
using (
    (select public.sfa_current_role()) = 'admin'
);

-- =====================================================
-- 7. STUDENT POLICIES
-- Admins and teachers can read student records.
-- Only admins can add, edit, or delete students.
-- =====================================================

drop policy if exists "sfa_students_staff_select" on public.sfa_students;
create policy "sfa_students_staff_select"
on public.sfa_students
for select to authenticated
using (
    (select public.sfa_current_role()) in ('admin', 'teacher')
);

drop policy if exists "sfa_students_admin_insert" on public.sfa_students;
create policy "sfa_students_admin_insert"
on public.sfa_students
for insert to authenticated
with check (
    (select public.sfa_current_role()) = 'admin'
);

drop policy if exists "sfa_students_admin_update" on public.sfa_students;
create policy "sfa_students_admin_update"
on public.sfa_students
for update to authenticated
using (
    (select public.sfa_current_role()) = 'admin'
)
with check (
    (select public.sfa_current_role()) = 'admin'
);

drop policy if exists "sfa_students_admin_delete" on public.sfa_students;
create policy "sfa_students_admin_delete"
on public.sfa_students
for delete to authenticated
using (
    (select public.sfa_current_role()) = 'admin'
);

-- =====================================================
-- 8. ATTENDANCE POLICIES
-- Admins and teachers can view attendance.
-- Staff can insert records only under their own user ID.
-- Only admins can update or delete attendance records.
-- =====================================================

drop policy if exists "sfa_attendance_staff_select" on public.sfa_attendance;
create policy "sfa_attendance_staff_select"
on public.sfa_attendance
for select to authenticated
using (
    (select public.sfa_current_role()) in ('admin', 'teacher')
);

drop policy if exists "sfa_attendance_staff_insert" on public.sfa_attendance;
create policy "sfa_attendance_staff_insert"
on public.sfa_attendance
for insert to authenticated
with check (
    (select public.sfa_current_role()) in ('admin', 'teacher')
    and marked_by = (select auth.uid())
);

drop policy if exists "sfa_attendance_admin_update" on public.sfa_attendance;
create policy "sfa_attendance_admin_update"
on public.sfa_attendance
for update to authenticated
using (
    (select public.sfa_current_role()) = 'admin'
)
with check (
    (select public.sfa_current_role()) = 'admin'
);

drop policy if exists "sfa_attendance_admin_delete" on public.sfa_attendance;
create policy "sfa_attendance_admin_delete"
on public.sfa_attendance
for delete to authenticated
using (
    (select public.sfa_current_role()) = 'admin'
);

-- =====================================================
-- 9. TABLE PRIVILEGES
-- RLS still applies after these grants.
-- =====================================================

grant usage on schema public to authenticated;

grant select, insert, update, delete
on public.sfa_profiles to authenticated;

grant select, insert, update, delete
on public.sfa_students to authenticated;

grant select, insert, update, delete
on public.sfa_attendance to authenticated;
