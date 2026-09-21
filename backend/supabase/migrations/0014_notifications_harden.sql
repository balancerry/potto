-- Harden notification helper/trigger privileges and search_path.

create or replace function public.format_paise(p_paise bigint)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when p_paise % 100 = 0 then '₹' || to_char(p_paise / 100, 'FM999G999G999')
    else '₹' || to_char(p_paise / 100.0, 'FM999G999G999D00')
  end;
$$;

create or replace function public.transaction_type_label(p_type text)
returns text
language sql
immutable
set search_path = public
as $$
  select case p_type
    when 'contribution' then 'added money'
    when 'pool_expense' then 'added an expense'
    when 'member_expense' then 'added an expense'
    when 'settlement' then 'recorded a settlement'
    else 'updated the pot'
  end;
$$;

revoke all on function public.format_paise(bigint) from public;
revoke all on function public.transaction_type_label(text) from public;
revoke all on function public.notify_join_request_event() from public;
revoke all on function public.notify_transaction_created() from public;

revoke all on function public.mark_notification_read(uuid) from public;
revoke all on function public.mark_all_notifications_read() from public;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;
