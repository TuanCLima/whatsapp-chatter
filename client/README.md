# Atomation web interface

The React/TypeScript frontend for WhatsApp Chatter: a public project landing page, responsive messaging inbox, and assistant configuration screens.

From the repository root:

```bash
pnpm --dir client install --frozen-lockfile
pnpm --dir client dev
pnpm --dir client build
```

The public landing page works without backend credentials. The workspace needs the Express backend and its configured integrations. See the [root README](../README.md) for architecture, environment variables, setup, and current limitations.
