-- Enable pgvector extension
create extension if not exists vector;

-- Public Users table linked to auth.users
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text,
  created_at timestamp with time zone default now()
);

-- Trigger to automatically copy auth.users to public.users
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, name, email)
  values (
    new.id, 
    coalesce(new.profile->>'name', split_part(new.email, '@', 1)), 
    new.email
  )
  on conflict (id) do update
  set name = excluded.name, email = excluded.email;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Goals table
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  date date not null,
  text text not null,
  status text not null,
  created_at timestamp with time zone default now()
);

-- Watched Apps table
create table if not exists public.watched_apps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  app_name text not null,
  daily_minutes_limit integer not null,
  daily_open_limit integer not null,
  created_at timestamp with time zone default now(),
  unique(user_id, app_name)
);

-- Usage Events table
create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  app_name text not null,
  opened_at timestamp with time zone not null default now(),
  duration_sec integer not null default 0,
  over_limit boolean not null default false
);

-- Interventions table
create table if not exists public.interventions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  usage_event_id uuid references public.usage_events(id) on delete cascade,
  agent_message text not null,
  recommended_action text not null,
  user_action text,
  created_at timestamp with time zone default now()
);

-- Stake Ledger table
create table if not exists public.stake_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  amount numeric not null,
  destination text not null,
  reason text not null,
  is_test boolean not null default true,
  created_at timestamp with time zone default now()
);

-- Vector Memories table
create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  content text not null,
  embedding vector(1536),
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now()
);

-- Vector Similarity Search Helper function
create or replace function public.retrieve_memories(
  p_user_id uuid,
  p_query_embedding vector(1536),
  p_limit integer
)
returns table (
  id uuid,
  content text,
  metadata jsonb,
  similarity numeric
) as $$
begin
  return query
  select
    m.id,
    m.content,
    m.metadata,
    (1 - (m.embedding <=> p_query_embedding))::numeric as similarity
  from public.memories m
  where m.user_id = p_user_id
  order by m.embedding <=> p_query_embedding
  limit p_limit;
end;
$$ language plpgsql security definer;
