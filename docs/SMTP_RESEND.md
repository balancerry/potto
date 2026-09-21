# Potto auth email (dev vs production)

## Current setup (no domain)

- Supabase **Confirm email** is **off** (`mailer_autoconfirm: true`).
- Signup is **email + password** (no verification link).
- Any inbox (Gmail, Yopmail, etc.) works for **Create account** and **password sign-in**.

Magic link and password-reset still need a working mail sender. Those only reliably reach addresses allowed by your SMTP setup until you own a verified domain.

## Production (when you own a domain)

1. Buy a domain (Cloudflare, Porkbun, etc.).
2. Add it in Resend and create the DNS records Resend shows.
3. Verify the domain in Resend.
4. Set Supabase custom SMTP sender to `noreply@yourdomain.com`.
5. Optionally turn **Confirm email** back on and restore magic-link signup if you want email verification again.

## Resend notes

Without a verified domain, Resend’s `onboarding@resend.dev` only delivers to the email on your Resend account. Do not rely on it for multi-user testing.
