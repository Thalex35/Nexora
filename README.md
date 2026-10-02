# Pixel Perfect Match

Implement exactly the screenshot and nothing else

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/aec7c8b7-6308-49b2-aea4-4bb4f8647759).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

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
