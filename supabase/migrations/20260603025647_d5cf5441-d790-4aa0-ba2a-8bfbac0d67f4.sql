create table if not exists public.app_config (
  key text primary key,
  value text not null,
  created_at timestamptz not null default now()
);

alter table public.app_config enable row level security;

grant all on public.app_config to service_role;

insert into public.app_config (key, value)
values ('notify_signup_secret', '_x8-LzfNH6PEVxA-SIp6m9zd7Mwcz0fQ')
on conflict (key) do nothing;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_secret text;
begin
  insert into public.profiles (user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.subscriptions (user_id, tier, trial_ends_at)
    values (new.id, 'free', now() + interval '14 days')
    on conflict (user_id) do nothing;

  select value into v_secret from public.app_config where key = 'notify_signup_secret';
  if v_secret is not null then
    perform net.http_post(
      url := 'https://project--1c631b6b-5915-4d4e-9b72-2bde38b27c4d.lovable.app/api/public/notify-signup',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-notify-secret', v_secret
      ),
      body := jsonb_build_object('email', new.email, 'user_id', new.id)
    );
  end if;

  return new;
end;
$function$;