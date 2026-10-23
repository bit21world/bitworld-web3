-- Aman dijalankan ulang. Jalankan di Neon > SQL Editor.
create table if not exists users (
  id            bigserial primary key,
  email         text unique not null,
  name          text,
  password_hash text not null,
  balance       bigint not null default 0,
  streak        int    not null default 0,
  last_claim    timestamptz,
  created_at    timestamptz not null default now()
);
create table if not exists mining_log (
  id         bigserial primary key,
  user_id    bigint not null references users(id) on delete cascade,
  amount     int not null,
  created_at timestamptz not null default now()
);

-- Verifikasi email: akun lama otomatis dianggap terverifikasi, akun baru default belum.
alter table users add column if not exists email_verified boolean not null default true;
alter table users alter column email_verified set default false;

-- Token untuk link verifikasi email & reset password (disimpan dalam bentuk hash)
create table if not exists tokens (
  id         bigserial primary key,
  user_id    bigint not null references users(id) on delete cascade,
  type       text not null,                -- 'verify' | 'reset'
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);

-- Pembatasan percobaan (anti tebak password / spam email)
create table if not exists auth_attempts (
  id         bigserial primary key,
  key        text not null,
  created_at timestamptz not null default now()
);
create index if not exists auth_attempts_key_idx on auth_attempts (key, created_at);
