# ClipVoy client

## Supabase account setup

The client uses the prebuilt `@supabase/auth-ui-react` component for email/password signup and sign-in, backed by `@supabase/supabase-js`. Auth UI is archived and no longer maintained; the integration is isolated in `src/components/AuthGate.tsx` to allow replacement later.

1. Create a Supabase project and enable the Email provider under Authentication → Providers.
2. Copy `.env.example` to `.env.local` in this `client` directory.
3. Set `VITE_SUPABASE_URL` to your project URL and `VITE_SUPABASE_PUBLISHABLE_KEY` to your publishable key (a legacy anon key also works). Find these in the project's Connect dialog / API settings. Never put a secret or service-role key in frontend environment variables.
4. In Authentication → URL Configuration, set your Site URL and add your app URL to the allowed redirect URLs (normally `http://localhost:5173` locally; use the actual Vite URL). Add your production URL when deploying.
5. Restart the client with `npm run dev` after changing environment variables.

The page starts with signup and includes Supabase's sign-in and password-recovery views. With email confirmation enabled, users must follow the confirmation email before accessing the studio. Supabase persists and refreshes the browser session; a Sign out button returns users to the account page.

Without project credentials the page displays the prebuilt signup form with its fields and submission disabled, plus a setup notice. The isolated preview client blocks all network requests and does not persist a session. Validate signup, confirmation, sign-in, refresh, sign-out, and password recovery once your project is configured.

This change controls the client UI only. The video API still needs server-side token verification before authentication can protect backend endpoints. Existing clip/job browser storage is shared on the device and is not scoped to individual accounts.

## Development

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
