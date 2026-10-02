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
