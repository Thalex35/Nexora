# Nexora

Nexora is a private personal workspace for daily planning, tasks, goals and projects.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Private authentication

Single-user mode is enabled unless `VITE_NEXORA_SINGLE_USER_MODE=false`. Configure
`VITE_NEXORA_AUTHORIZED_USER_ID` with the existing Supabase Auth user's UUID in
each build environment. If it is missing, authenticated sessions are denied by
default. The UUID is a public identifier, not an authentication secret.

To allow public account creation in a future multi-user release, set
`VITE_NEXORA_SINGLE_USER_MODE=false` and reintroduce an explicit registration
flow. Keep **Allow new users to sign up** disabled in Supabase Auth settings;
the application itself contains no registration flow.

### Password recovery email setup

The recovery form redirects to `/reset-password` on the origin that submitted the
request. In Supabase Dashboard, configure **Authentication → URL Configuration**
with `https://nexora-lmg.vercel.app` as the Site URL and add
`https://nexora-lmg.vercel.app/reset-password` to the allowed Redirect URLs.
Add local or preview callback URLs only when those environments are used, and
keep public sign-up disabled.

The browser Auth client uses Supabase's PKCE flow for recovery and OAuth callbacks.
Open recovery links in the same browser that requested them so the PKCE verifier
is available. After deploying an authentication-flow change, request a fresh
recovery email; links already issued under an earlier flow may not complete in
the updated client.

Email delivery is controlled by Supabase, not by the application build. Verify
the project’s SMTP provider, sender identity/domain, delivery/rate limits, and
the Authentication email template’s confirmation URL. For a missing message,
check Supabase Auth/email logs and the SMTP provider’s delivery, bounce, and
spam records for the request time. Do not put SMTP credentials or other secrets
in this repository. Test by requesting a message for the authorized account,
following the newest link, and completing the password update.
