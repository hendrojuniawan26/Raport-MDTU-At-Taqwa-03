-- ============================================================================
-- SKEMA DATABASE SUPABASE (PostgreSQL)
-- Sistem Pengolahan Nilai Raport MDTU AT-TAQWA '03 Cibeureum - Cimahi
-- Mendukung 4 Peran: Admin, Wali Kelas, Guru Mapel, dan Orang Tua / Wali Santri
-- Jalankan seluruh script ini di SQL Editor Dashboard Supabase Anda.
-- ============================================================================

create extension if not exists "pgcrypto";

-- 1. Tabel Profil Pengguna (Terhubung ke Supabase Auth)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  role text not null default 'wali_kelas' check (role in ('admin', 'wali_kelas', 'guru', 'orang_tua')),
  nip_nuptk text default '-',
  assigned_class_id uuid,
  assigned_subject_ids uuid[] not null default '{}',
  linked_student_id uuid,
  linked_student_nis text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Tabel Identitas Madrasah & Konfigurasi Penilaian
create table if not exists public.madrasah_settings (
  id uuid primary key default gen_random_uuid(),
  yayasan text not null default 'LEMBAGA PENGEMBANGAN PENDIDIKAN AGAMA ISLAM (LP2AI)',
  nama_madrasah text not null default 'MADRASAH DINIYAH TAKMILIYAH “AT-TAQWA ‘03”',
  sub_madrasah text not null default 'AHLUS SUNNAH WAL JAMA’AH (ASWAJA)',
  nsm text not null default '311232770003',
  alamat text not null default 'Jl. Terusan Mukodar 235 RT.05 RW.03 Kel. Cibeureum',
  kecamatan text not null default 'Kec. Cimahi Selatan',
  kabupaten text not null default 'Kota Cimahi',
  provinsi text not null default 'Jawa Barat',
  kode_pos text not null default '40535',
  kepala_madrasah text not null default 'Kiagus Akbar Saman, M.Pd',
  nip_kepala text not null default 'NUPTK: 7538759660130152',
  tempat_cetak text not null default 'Cimahi',
  tanggal_raport text not null default '22 Desember 2025',
  tahun_pelajaran text not null default '2025-2026',
  semester text not null default 'Ganjil' check (semester in ('Ganjil', 'Genap')),
  bobot_formatif integer not null default 30 check (bobot_formatif between 0 and 100),
  bobot_pts integer not null default 20 check (bobot_pts between 0 and 100),
  bobot_pas integer not null default 30 check (bobot_pas between 0 and 100),
  bobot_praktik integer not null default 20 check (bobot_praktik between 0 and 100),
  ukuran_kertas text not null default 'A4' check (ukuran_kertas in ('F4', 'A4')),
  updated_at timestamptz not null default now()
);

-- 3. Tabel Kelas & Wali Kelas
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  level integer not null check (level between 1 and 6),
  academic_year text not null default '2025-2026',
  wali_kelas_id uuid references public.profiles(id) on delete set null,
  wali_kelas_name text not null,
  wali_kelas_nip text default '-',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(name, academic_year)
);

-- 4. Tabel Mata Pelajaran, Guru Pengampu & KKM
create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  arabic_name text default '',
  teacher_name text not null default '-',
  category text not null default 'Pengetahuan' check (category in ('Pengetahuan', 'Praktik')),
  kkm integer not null default 62 check (kkm between 0 and 100),
  sort_order integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5. Tabel Data Master Santri
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  nis text not null unique,
  nisn text default '',
  full_name text not null,
  birth_place text not null default 'Cimahi',
  birth_date date,
  gender text not null default 'L' check (gender in ('L', 'P')),
  parent_name text not null default '-',
  address text default '-',
  class_id uuid not null references public.classes(id) on delete restrict,
  status text not null default 'Aktif' check (status in ('Aktif', 'Lulus', 'Pindah')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Foreign Keys tambahan pada profiles untuk relasi kelas & santri
alter table public.profiles
  drop constraint if exists profiles_assigned_class_fkey,
  add constraint profiles_assigned_class_fkey
    foreign key (assigned_class_id) references public.classes(id) on delete set null;

alter table public.profiles
  drop constraint if exists profiles_linked_student_fkey,
  add constraint profiles_linked_student_fkey
    foreign key (linked_student_id) references public.students(id) on delete set null;

-- 6. Tabel Nilai Akademik per Mapel (Pengetahuan & Praktik)
create table if not exists public.grades (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  academic_year text not null default '2025-2026',
  semester text not null default 'Ganjil' check (semester in ('Ganjil', 'Genap')),
  formatif numeric(5,2) not null default 0 check (formatif between 0 and 100),
  pts numeric(5,2) not null default 0 check (pts between 0 and 100),
  pas numeric(5,2) not null default 0 check (pas between 0 and 100),
  praktik numeric(5,2) not null default 0 check (praktik between 0 and 100),
  final_score integer not null default 0 check (final_score between 0 and 100),
  predicate text not null default '-',
  description text not null default '-',
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(student_id, subject_id, academic_year, semester)
);

-- 7. Tabel Penilaian Sikap (Spiritual & Sosial), Absensi & Pesan Walas
create table if not exists public.non_academic_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  academic_year text not null default '2025-2026',
  semester text not null default 'Ganjil' check (semester in ('Ganjil', 'Genap')),
  sikap_spiritual_angka integer not null default 82 check (sikap_spiritual_angka between 0 and 100),
  sikap_spiritual text not null default 'Berkembang Sesuai Harapan',
  akhlak_catatan text not null default 'Siswa memiliki sikap yang berkembang sesuai harapan dalam nilai religious meliputi beriman, bertaqwa, bersih, toleransi, dan cinta lingkungan',
  sikap_sosial_angka integer not null default 82 check (sikap_sosial_angka between 0 and 100),
  sikap_sosial text not null default 'Berkembang Sesuai Harapan',
  sosial_catatan text not null default 'Siswa memiliki sikap berkembang sesuai harapan dalam melakukan interaksi dengan teman dan lingkungannya',
  ekskul_1_nama text not null default 'Tahfidz Al-Qur''an',
  ekskul_1_nilai text not null default 'B',
  ekskul_2_nama text not null default 'Khot / Kaligrafi',
  ekskul_2_nilai text not null default 'B',
  sakit integer not null default 0 check (sakit >= 0),
  izin integer not null default 0 check (izin >= 0),
  alpa integer not null default 0 check (alpa >= 0),
  catatan_wali text not null default 'Ananda mengikuti pembelajaran dengan baik dan menunjukkan sikap yang sopan. Semoga terus meningkatkan semangat belajar.',
  keputusan_naik text not null default 'Lanjut ke Semester Genap',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(student_id, academic_year, semester)
);

-- Indexes
create index if not exists idx_students_class on public.students(class_id);
create index if not exists idx_students_nis on public.students(nis);
create index if not exists idx_grades_class_term on public.grades(class_id, academic_year, semester);
create index if not exists idx_grades_student_term on public.grades(student_id, academic_year, semester);
create index if not exists idx_non_academic_class_term on public.non_academic_records(class_id, academic_year, semester);

-- Trigger Auto Update Timestamp & Profile
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles for each row execute function public.set_updated_at();

drop trigger if exists trg_settings_updated on public.madrasah_settings;
create trigger trg_settings_updated before update on public.madrasah_settings for each row execute function public.set_updated_at();

drop trigger if exists trg_classes_updated on public.classes;
create trigger trg_classes_updated before update on public.classes for each row execute function public.set_updated_at();

drop trigger if exists trg_subjects_updated on public.subjects;
create trigger trg_subjects_updated before update on public.subjects for each row execute function public.set_updated_at();

drop trigger if exists trg_students_updated on public.students;
create trigger trg_students_updated before update on public.students for each row execute function public.set_updated_at();

drop trigger if exists trg_grades_updated on public.grades;
create trigger trg_grades_updated before update on public.grades for each row execute function public.set_updated_at();

drop trigger if exists trg_non_academic_updated on public.non_academic_records;
create trigger trg_non_academic_updated before update on public.non_academic_records for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role text;
  v_class_id uuid;
  v_subject_ids uuid[] := '{}';
  v_student_nis text;
  v_student_id uuid;
begin
  v_role := nullif(trim(coalesce(new.raw_user_meta_data->>'role', '')), '');
  if v_role is null then
    if not exists (select 1 from public.profiles where role = 'admin') then
      v_role := 'admin';
    else
      v_role := 'wali_kelas';
    end if;
  elsif v_role not in ('admin', 'wali_kelas', 'guru', 'orang_tua') then
    v_role := 'wali_kelas';
  end if;

  begin
    v_class_id := nullif(new.raw_user_meta_data->>'assigned_class_id', '')::uuid;
  exception when others then
    v_class_id := null;
  end;

  begin
    select coalesce(array_agg(x::uuid), '{}')
    into v_subject_ids
    from jsonb_array_elements_text(
      coalesce(new.raw_user_meta_data->'assigned_subject_ids', '[]'::jsonb)
    ) as t(x);
  exception when others then
    v_subject_ids := '{}';
  end;

  v_student_nis := trim(coalesce(new.raw_user_meta_data->>'linked_student_nis', ''));
  if v_student_nis <> '' then
    select id into v_student_id
    from public.students
    where lower(trim(nis)) = lower(v_student_nis)
    limit 1;
  end if;

  insert into public.profiles (
    id, email, full_name, role, assigned_class_id, assigned_subject_ids, linked_student_id, linked_student_nis
  )
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email, 'Pengguna'), '@', 1)),
    v_role,
    v_class_id,
    v_subject_ids,
    v_student_id,
    v_student_nis
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Row Level Security (RLS) untuk 4 Peran
alter table public.profiles enable row level security;
alter table public.madrasah_settings enable row level security;
alter table public.classes enable row level security;
alter table public.subjects enable row level security;
alter table public.students enable row level security;
alter table public.grades enable row level security;
alter table public.non_academic_records enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'wali_kelas', 'guru'));
$$;

create or replace function public.is_wali_of_class(target_class_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.classes c
    where c.id = target_class_id and c.wali_kelas_id = auth.uid()
  ) or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'wali_kelas' and p.assigned_class_id = target_class_id
  );
$$;

create or replace function public.is_guru_of_subject(target_subject_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    join public.subjects s on s.id = target_subject_id
    where p.id = auth.uid()
      and p.role = 'guru'
      and (
        target_subject_id = any(p.assigned_subject_ids)
        or lower(trim(s.teacher_name)) = lower(trim(p.full_name))
      )
  );
$$;

create or replace function public.is_parent_of_student(target_student_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    join public.students st on st.id = target_student_id
    where p.id = auth.uid()
      and p.role = 'orang_tua'
      and (
        p.linked_student_id = target_student_id
        or (trim(p.linked_student_nis) <> '' and lower(trim(st.nis)) = lower(trim(p.linked_student_nis)))
      )
  );
$$;

-- Admin RPC: Buat akun pengguna baru langsung aktif tanpa terkendala batas email konfirmasi SMTP
create or replace function public.admin_create_user_account(
  p_email text,
  p_password text,
  p_full_name text,
  p_role text default 'guru',
  p_assigned_class_id uuid default null,
  p_assigned_subject_ids uuid[] default '{}',
  p_linked_student_nis text default ''
)
returns public.profiles
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_user_id uuid := gen_random_uuid();
  v_email text := lower(trim(coalesce(p_email, '')));
  v_full_name text := trim(coalesce(p_full_name, ''));
  v_role text;
  v_student_nis text := trim(coalesce(p_linked_student_nis, ''));
  v_student_id uuid;
  v_profile public.profiles;
begin
  if not public.is_admin() then
    raise exception 'Hanya Admin Madrasah yang dapat membuat akun baru.';
  end if;

  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'Alamat email tidak valid.';
  end if;

  if v_full_name = '' then
    raise exception 'Nama lengkap wajib diisi.';
  end if;

  if length(coalesce(p_password, '')) < 6 then
    raise exception 'Kata sandi awal minimal 6 karakter.';
  end if;

  v_role := case
    when p_role in ('admin', 'wali_kelas', 'guru', 'orang_tua') then p_role
    else 'guru'
  end;

  if exists (
    select 1 from auth.users
    where lower(email) = v_email
      and deleted_at is null
  ) then
    raise exception 'Email "%" sudah terdaftar pada sistem.', v_email;
  end if;

  if v_role = 'orang_tua' and v_student_nis <> '' then
    select id into v_student_id
    from public.students
    where lower(trim(nis)) = lower(v_student_nis)
    limit 1;
  end if;

  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    v_email,
    crypt(p_password, gen_salt('bf', 10)),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'full_name', v_full_name,
      'role', v_role,
      'assigned_class_id', case when v_role = 'wali_kelas' and p_assigned_class_id is not null then p_assigned_class_id::text else '' end,
      'assigned_subject_ids', case when v_role = 'guru' then to_jsonb(coalesce(p_assigned_subject_ids, '{}'::uuid[])) else '[]'::jsonb end,
      'linked_student_nis', case when v_role = 'orang_tua' then v_student_nis else '' end
    ),
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) values (
    gen_random_uuid(),
    v_user_id,
    jsonb_build_object(
      'sub', v_user_id::text,
      'email', v_email,
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    v_user_id::text,
    now(),
    now(),
    now()
  )
  on conflict do nothing;

  insert into public.profiles (
    id,
    email,
    full_name,
    role,
    assigned_class_id,
    assigned_subject_ids,
    linked_student_id,
    linked_student_nis
  ) values (
    v_user_id,
    v_email,
    v_full_name,
    v_role,
    case when v_role = 'wali_kelas' then p_assigned_class_id else null end,
    case when v_role = 'guru' then coalesce(p_assigned_subject_ids, '{}'::uuid[]) else '{}'::uuid[] end,
    case when v_role = 'orang_tua' then v_student_id else null end,
    case when v_role = 'orang_tua' then v_student_nis else '' end
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    role = excluded.role,
    assigned_class_id = excluded.assigned_class_id,
    assigned_subject_ids = excluded.assigned_subject_ids,
    linked_student_id = excluded.linked_student_id,
    linked_student_nis = excluded.linked_student_nis
  returning * into v_profile;

  return v_profile;
end;
$$;

revoke all on function public.admin_create_user_account(text, text, text, text, uuid, uuid[], text) from public, anon;
grant execute on function public.admin_create_user_account(text, text, text, text, uuid, uuid[], text) to authenticated;

-- Admin RPC: Ubah kata sandi akun pengguna secara aman
create or replace function public.admin_update_user_password(
  target_user_id uuid,
  new_password text
)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  if not public.is_admin() then
    raise exception 'Hanya Admin Madrasah yang dapat mengubah kata sandi akun.';
  end if;
  if length(coalesce(new_password, '')) < 6 then
    raise exception 'Kata sandi baru minimal 6 karakter.';
  end if;

  update auth.users
  set
    encrypted_password = crypt(new_password, gen_salt('bf', 10)),
    email_confirmed_at = coalesce(email_confirmed_at, now()),
    updated_at = now()
  where id = target_user_id;

  if not found then
    raise exception 'Akun pengguna tidak ditemukan di sistem autentikasi.';
  end if;
end;
$$;

revoke all on function public.admin_update_user_password(uuid, text) from public, anon;
grant execute on function public.admin_update_user_password(uuid, text) to authenticated;

-- Admin RPC: Hapus akun pengguna beserta profilnya
create or replace function public.admin_delete_user_account(
  target_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'Hanya Admin Madrasah yang dapat menghapus akun.';
  end if;
  if target_user_id = auth.uid() then
    raise exception 'Tidak dapat menghapus akun Admin yang sedang aktif digunakan.';
  end if;

  delete from auth.users where id = target_user_id;
  delete from public.profiles where id = target_user_id;
end;
$$;

revoke all on function public.admin_delete_user_account(uuid) from public, anon;
grant execute on function public.admin_delete_user_account(uuid) to authenticated;

-- Parent RPC: Hitung peringkat & jumlah santri aktif sekelas tanpa membuka data santri lain
create or replace function public.get_parent_student_rank(
  target_student_id uuid,
  target_academic_year text,
  target_semester text
)
returns table (rank integer, total_students integer)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_class_id uuid;
begin
  if not (public.is_staff() or public.is_parent_of_student(target_student_id)) then
    raise exception 'Akses ditolak.';
  end if;

  select class_id into v_class_id
  from public.students
  where id = target_student_id;

  if v_class_id is null then
    return query select 1, 1;
    return;
  end if;

  return query
  with student_totals as (
    select
      s.id as sid,
      coalesce(sum(g.final_score), 0) as total_score
    from public.students s
    left join public.grades g
      on g.student_id = s.id
      and g.academic_year = target_academic_year
      and g.semester = target_semester
    where s.class_id = v_class_id
      and s.status = 'Aktif'
    group by s.id
  ),
  ranked as (
    select
      sid,
      rank() over (order by total_score desc)::integer as r,
      count(*) over ()::integer as total_cnt
    from student_totals
  )
  select r, total_cnt from ranked where sid = target_student_id;
end;
$$;

revoke all on function public.get_parent_student_rank(uuid, text, text) from public, anon;
grant execute on function public.get_parent_student_rank(uuid, text, text) to authenticated;

-- Policies Profiles
drop policy if exists "Users view profiles" on public.profiles;
drop policy if exists "Users view own or admin view all profiles" on public.profiles;
create policy "Users view own or admin view all profiles" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin() or public.is_staff());

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "Admins manage profiles" on public.profiles;
create policy "Admins manage profiles" on public.profiles
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Policies Settings, Classes, Subjects (Metadata publik madrasah dapat dibaca)
drop policy if exists "Auth read settings" on public.madrasah_settings;
create policy "Auth read settings" on public.madrasah_settings for select to anon, authenticated using (true);
drop policy if exists "Admins manage settings" on public.madrasah_settings;
create policy "Admins manage settings" on public.madrasah_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Auth read classes" on public.classes;
create policy "Auth read classes" on public.classes for select to anon, authenticated using (true);
drop policy if exists "Admins manage classes" on public.classes;
create policy "Admins manage classes" on public.classes for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Auth read subjects" on public.subjects;
create policy "Auth read subjects" on public.subjects for select to anon, authenticated using (true);
drop policy if exists "Admins manage subjects" on public.subjects;
create policy "Admins manage subjects" on public.subjects for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Policies Students (Staf lihat semua; Orang Tua hanya lihat anaknya)
drop policy if exists "Auth read students" on public.students;
drop policy if exists "Staff or parent read students" on public.students;
create policy "Staff or parent read students" on public.students
  for select to authenticated
  using (public.is_staff() or public.is_parent_of_student(id));

drop policy if exists "Admins & walas insert students" on public.students;
create policy "Admins & walas insert students" on public.students
  for insert to authenticated
  with check (public.is_admin() or public.is_wali_of_class(class_id));

drop policy if exists "Admins & walas update students" on public.students;
create policy "Admins & walas update students" on public.students
  for update to authenticated
  using (public.is_admin() or public.is_wali_of_class(class_id))
  with check (public.is_admin() or public.is_wali_of_class(class_id));

drop policy if exists "Admins delete students" on public.students;
create policy "Admins delete students" on public.students
  for delete to authenticated using (public.is_admin());

-- Policies Grades (Staf baca semua; Orang Tua hanya baca nilai anaknya; Guru hanya ubah mapelnya)
drop policy if exists "Auth read grades" on public.grades;
drop policy if exists "Staff or parent read grades" on public.grades;
create policy "Staff or parent read grades" on public.grades
  for select to authenticated
  using (public.is_staff() or public.is_parent_of_student(student_id));

drop policy if exists "Admins & walas manage grades" on public.grades;
drop policy if exists "Admins, walas & guru manage grades" on public.grades;
create policy "Admins, walas & guru manage grades" on public.grades
  for all to authenticated
  using (
    public.is_admin()
    or public.is_wali_of_class(class_id)
    or public.is_guru_of_subject(subject_id)
  )
  with check (
    public.is_admin()
    or public.is_wali_of_class(class_id)
    or public.is_guru_of_subject(subject_id)
  );

-- Policies Non Academic
drop policy if exists "Auth read non_academic" on public.non_academic_records;
drop policy if exists "Staff or parent read non_academic" on public.non_academic_records;
create policy "Staff or parent read non_academic" on public.non_academic_records
  for select to authenticated
  using (public.is_staff() or public.is_parent_of_student(student_id));

drop policy if exists "Admins & walas manage non_academic" on public.non_academic_records;
create policy "Admins & walas manage non_academic" on public.non_academic_records
  for all to authenticated
  using (public.is_admin() or public.is_wali_of_class(class_id))
  with check (public.is_admin() or public.is_wali_of_class(class_id));

-- Data Awal MDTU At-Taqwa '03 Cimahi
insert into public.madrasah_settings (nama_madrasah)
select 'MADRASAH DINIYAH TAKMILIYAH “AT-TAQWA ‘03”'
where not exists (select 1 from public.madrasah_settings);

insert into public.subjects (code, name, arabic_name, teacher_name, category, kkm, sort_order) values
  ('AQ',  'AL-QURAN/TAJWID',               'القرآن والتجويد', 'Osi Rosmawati',             'Pengetahuan', 62, 1),
  ('HD',  'AL-HADITS',                     'الحديث',          'Novizal Darwis, S.Ag',      'Pengetahuan', 62, 2),
  ('AQD', 'AQIDAH/TAUHID',                 'العقيدة',         'Yasir Jum''aturrohman',     'Pengetahuan', 62, 3),
  ('AKH', 'AKHLAK',                        'الأخلاق',         'Kuswati Endah W., S.Pd',    'Pengetahuan', 62, 4),
  ('FQH', 'FIQIH',                         'الفقه',           'Hendro Kartika J., M.Hum',  'Pengetahuan', 62, 5),
  ('SKH', 'TARIKH / SEJARAH ISLAM',        'تاريخ الإسلام',   'Osi Rosmawati',             'Pengetahuan', 62, 6),
  ('NRN', 'NURONIYAH/BACAAN AL-QUR''AN',   'النورانية',       'Osi Rosmawati',             'Praktik',     62, 7),
  ('JUZ', 'HAFALAN JUZ 30',                'حفظ جزء عم',      'Osi Rosmawati',             'Praktik',     62, 8),
  ('KHT', 'KHOT IMLA',                     'الخط والإملاء',   'Hendro Kartika J., M.Hum',  'Praktik',     62, 9),
  ('PRD', 'PRAKTEK IBADAH',                'العبادة العملية', 'Hendro Kartika J., M.Hum',  'Praktik',     62, 10)
on conflict (code) do nothing;

-- Refresh cache API Supabase agar fungsi RPC terbaru langsung aktif
notify pgrst, 'reload schema';
