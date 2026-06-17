create or replace function public.notify_support_message()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_secret text;
  v_email text;
  v_subject text;
begin
  if new.is_agent then
    return new;
  end if;

  select value into v_secret from public.app_config where key = 'notify_signup_secret';
  if v_secret is null then
    return new;
  end if;

  select email into v_email from auth.users where id = new.sender_id;
  select subject into v_subject from public.support_tickets where id = new.ticket_id;

  perform net.http_post(
    url := 'https://project--1c631b6b-5915-4d4e-9b72-2bde38b27c4d.lovable.app/api/public/notify-event',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-notify-secret', v_secret
    ),
    body := jsonb_build_object(
      'type', 'support',
      'email', v_email,
      'subject', v_subject,
      'body', new.body
    )
  );

  return new;
end;
$function$;

revoke execute on function public.notify_support_message() from public, anon, authenticated;

drop trigger if exists trg_notify_support_message on public.support_messages;
create trigger trg_notify_support_message
  after insert on public.support_messages
  for each row execute function public.notify_support_message();

create or replace function public.notify_payment_submitted()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_secret text;
  v_email text;
begin
  if new.status <> 'submitted' or old.status is not distinct from new.status then
    return new;
  end if;

  select value into v_secret from public.app_config where key = 'notify_signup_secret';
  if v_secret is null then
    return new;
  end if;

  select email into v_email from auth.users where id = new.user_id;

  perform net.http_post(
    url := 'https://project--1c631b6b-5915-4d4e-9b72-2bde38b27c4d.lovable.app/api/public/notify-event',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-notify-secret', v_secret
    ),
    body := jsonb_build_object(
      'type', 'payment',
      'email', v_email,
      'plan', new.plan,
      'amount', new.total_amount
    )
  );

  return new;
end;
$function$;

revoke execute on function public.notify_payment_submitted() from public, anon, authenticated;

drop trigger if exists trg_notify_payment_submitted on public.payment_requests;
create trigger trg_notify_payment_submitted
  after update on public.payment_requests
  for each row execute function public.notify_payment_submitted();