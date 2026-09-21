-- Allow anonymous signup UI to check whether an email already has a Potto profile.
-- Returns only a boolean — no profile fields leaked.

create or replace function public.email_registered(p_email text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.users
    where email is not null
      and lower(email) = lower(trim(p_email))
  );
$$;

revoke all on function public.email_registered(text) from public;
grant execute on function public.email_registered(text) to anon, authenticated;
