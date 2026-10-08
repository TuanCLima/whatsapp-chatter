# WhatsApp Chatter · Atomation

**An AI-powered WhatsApp workspace with a React inbox, configurable assistant tools, and Google Calendar scheduling.**

A full-stack side project by **Tuan Lima**, connecting conversational AI with practical workflows: answering questions, checking appointment availability, sharing information, and handing conversations back to a person.

![Atomation landing page with an illustrative appointment conversation](docs/images/landing-desktop.jpg)

[Mobile screenshot](docs/images/landing-mobile.jpg) · [Features](#what-it-does) · [Architecture](#architecture) · [Local setup](#local-development) · [Project status](#project-status) · [License](LICENSE)

## What it does

- **Responsive conversation inbox:** contacts, message history, unread indicators, media rendering, and manual replies. Pause the assistant for an individual conversation.
- **WhatsApp messaging:** receive Twilio webhooks and send assistant responses through a configured WhatsApp sender.
- **Configurable AI assistant:** account-specific instructions and tools, with OpenAI chat completions and tool execution on the backend.
- **Calendar workflows:** Google OAuth, calendar selection, availability checks, appointment creation, and scheduling rules such as working hours and minimum notice.
- **Account configuration:** registration/login, per-account Twilio credentials, assistant settings, and conversation associations.
- **Live inbox updates:** server-sent events notify the client when messages and contacts change.

The public landing page includes a **fictional, static conversation preview**. It illustrates the scheduling workflow and is not a live assistant or customer transcript.

## Architecture

```mermaid
flowchart LR
    customer[WhatsApp user] <--> twilio[Twilio]
    twilio <--> api[Express / TypeScript]
    inbox[React inbox] <-->|HTTP + server-sent events| api
    api <--> db[(PostgreSQL / Drizzle)]
    api <--> llm[OpenAI + assistant tools]
    api <--> calendar[Google Calendar]
    api --> media[S3 media storage]
```

Incoming messages enter through `POST /webhook`. The backend associates a conversation with its account, stores message history, builds context, and executes assistant tools before sending replies through Twilio. The web inbox consumes HTTP endpoints and SSE updates. Calendar and media features use separately configured integrations.

| Layer | Technologies |
| --- | --- |
| Web interface | React 18, TypeScript, Vite, Tailwind CSS, Radix/shadcn components |
| Client data | TanStack Query, React context, server-sent events |
| API and messaging | Node.js, Express, TypeScript, Twilio |
| AI | OpenAI chat completions and configurable tool execution |
| Persistence | PostgreSQL, Drizzle ORM |
| Integrations | Google Calendar OAuth, AWS S3, Resend |

### Repository map

```text
client/src/
  components/marketing/   Public landing page and illustrated workflow
  components/chat/        Conversation view and message composer
  components/config/      Assistant, tools, calendar and Twilio settings
  context/                Authentication and chat state
  services/               API clients and SSE handling
src/
  index.ts                Express entry point and HTTP routes
  webhook.ts              Incoming WhatsApp message processing
  getNextMessages.ts      LLM responses and tool-call loop
  db/                     PostgreSQL schema and connection
  routes/                 Integration and configuration endpoints
  services/               Account, messaging and assistant services
  googleCalendar/         OAuth helpers
migrations/               Database migration history
docs/images/              Project screenshots
```

## Local development

### 1. Prerequisites

Use Node.js 22 and pnpm 11. The checked-in pnpm settings allow the esbuild installation hook needed for Vite. A PostgreSQL database and integration credentials are needed for the full application; the landing-page preview can run independently.

```bash
git clone https://github.com/TuanCLima/whatsapp-chatter.git
cd whatsapp-chatter
pnpm install --frozen-lockfile
pnpm --dir client install --frozen-lockfile
```

### 2. Preview the interface without service credentials

```bash
pnpm --dir client dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`). The landing page and its illustrative conversation require no database, Twilio, or AI account. The authenticated workspace requires the backend described below.

### 3. Configure the backend

Copy `.env.example` to `.env` and fill the values for your own development accounts. Keep `.env`, OAuth credentials, and tokens out of source control.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER` | Legacy/fallback Twilio client; account-specific settings are also available in the UI |
| `LLM_API_KEY`, `LLM_MODEL` | OpenAI key and model; the backend currently uses the OpenAI API endpoint |
| `GOOGLE_CREDENTIALS` | Google OAuth web-client JSON, raw or base64; alternatively a local `credentials.json` |
| `DEPLOYMENT_URL` | Public backend URL for external callbacks; no trailing slash |
| `APP_BASE_URL` | Frontend URL used in verification emails |
| `RESEND_API_KEY`, `EMAIL_FROM` | Verification email delivery |
| `AWS_REGION`, `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Optional S3 media storage |
| `LOGFLARE_SOURCE_TOKEN`, `LOGFLARE_API_KEY` | Optional remote logging |

The existing Google OAuth helper reads credentials on startup, so provide the OAuth configuration when running the full backend, even if you are only exploring the inbox. Use a local callback such as `http://localhost:3000/oauth2callback` in your OAuth web client. See [Google OAuth notes](GOOGLE_OAUTH_VERIFICATION.md) and [S3 setup](AWS_S3_SETUP.md) for integration details.

### 4. Prepare a development database

For a **new, disposable local database**, export `DATABASE_URL` and apply the schema:

```bash
export DATABASE_URL='postgresql://postgres:postgres@localhost:5432/chat_webhook'
pnpm db:push
```

`drizzle.config.ts` reads the shell environment directly. Keep the exported URL consistent with `.env`. `db:push` changes the selected database schema; use the migration history and review schema changes separately for existing databases.

### 5. Start both services

In separate terminals:

```bash
# Backend: http://localhost:3000
pnpm dev
```

```bash
# Frontend: http://localhost:5173
pnpm --dir client dev
```

Open `/app` on the frontend to register or sign in, configure the Twilio sender, and set up the assistant. For real WhatsApp messages, Twilio must be able to reach your backend over HTTPS; configure the incoming-message webhook as `POST https://YOUR_BACKEND/webhook`. Calendar, email, and WhatsApp operations depend on your provider configuration and may incur provider charges.

### Build and validation

```bash
pnpm --dir client build
pnpm --dir client exec eslint src/components/marketing/LandingPage.tsx src/App.tsx
```

Production serves the built client from Express. `pnpm start` runs the TypeScript backend with `tsx`; the root build script builds the frontend. The project currently has no automated integration-test suite. A successful UI build does not verify live WhatsApp delivery, OAuth, email, or database workflows.

## Project status

This is a working-development portfolio project, with the evolved interface from `improve-chat-UI` now incorporated into `main`. It is not presented as a production-hardened service.

Current limitations include unsigned prototype session tokens, incomplete authentication coverage on legacy inbox endpoints, and email verification that is not enforced at login. Review and harden these areas before connecting real customer data or exposing a deployment. Billing, durable webhook retries, and comprehensive integration tests remain future work. Earlier design notes in [SAAS_FEATURES.md](SAAS_FEATURES.md) describe intent and may differ from the current implementation.

## License

[MIT](LICENSE). The original license is retained from `main`.
