# AI Chatbot Platform

A multi-tenant SaaS platform for building, embedding, and running AI-powered chat
(and voice) support widgets on any website — with bring-your-own-key AI/CRM/voice
credentials, a knowledge-base-backed RAG pipeline, and live human handoff.

## What this is

Each signed-up user creates one or more **bots**. Every bot gets:

- An embeddable chat widget (`<script>` snippet) that can be dropped into any
  website, regardless of tech stack.
- A knowledge base (pasted text or PDF upload) that's chunked, embedded, and
  used for retrieval-augmented answers.
- Its own AI provider and key — **bring your own key** across five providers
  (Gemini, OpenAI, Anthropic, Groq, Mistral), not a shared platform key.
- Optional HubSpot CRM sync (contacts + call engagement notes) and Vapi voice
  agent integration — also BYOK, encrypted at rest.
- Optional live agent handoff — a visitor can request a human, and an admin can
  take over the conversation from the dashboard mid-chat.
- Usage tracking (messages/tokens per month) and per-bot rate limiting.

## Architecture

```
backend/   NestJS API — auth, bots, chat, knowledge base, CRM, voice, usage
admin/     Next.js dashboard — manage bots, knowledge, conversations, CRM sync
backend/public/widget.js   The embeddable widget served directly by the API
```

- **Database**: Postgres (TypeORM), schema managed via migrations in
  `backend/src/database/migrations`.
- **Auth**: JWT-based; self-serve signup (first-ever user becomes the platform's
  super admin), password reset via email (Resend).
- **AI**: LangChain under a provider-agnostic `AiService`, with per-bot BYOK
  credentials encrypted at rest (AES-256-GCM) and never returned by the API —
  only "is a key configured" flags are.
- **Multi-tenancy**: every bot belongs to exactly one user; every query is
  scoped by ownership.
- **Widget transport**: plain REST + short-interval polling (not WebSockets) for
  live handoff message delivery — simple, no persistent-connection
  infrastructure required.

## Tech stack

| | |
|---|---|
| Backend | NestJS, TypeORM, PostgreSQL, LangChain, Passport/JWT |
| Admin | Next.js (App Router), React |
| Widget | Vanilla JS, no build step, no framework dependency |
| AI providers | Gemini, OpenAI, Anthropic, Groq, Mistral (per-bot choice) |
| Integrations | HubSpot (CRM), Vapi (voice), Resend (email) |

## Getting started

### Prerequisites
- Node.js, npm
- A PostgreSQL database
- `openssl` (to generate the encryption key)

### 1. Backend
```bash
cd backend
cp .env.example .env
# Fill in DB_*, JWT_SECRET, and:
#   ENCRYPTION_KEY=$(openssl rand -hex 32)
npm install
npm run migration:run
npm run start:dev        # http://localhost:3000 (or $PORT)
```

### 2. Admin dashboard
```bash
cd admin
npm install
npm run dev               # http://localhost:3005
```

### 3. Embed the widget on a test page
```html
<script src="http://localhost:3000/widget.js" data-bot-key="<bot's apiKey>"></script>
```

The first account you register through the admin app's `/register` page
becomes the platform's `SUPER_ADMIN`; every account after that is a normal
tenant with its own isolated bots.

### Running tests
A dedicated test database (`ai_chatbot_test`, same Postgres server, isolated
from dev data) is expected for integration-style tests:
```bash
cd backend
npm run migration:run:test   # applies the schema to ai_chatbot_test
npm test                     # unit tests
```

## Key concepts

- **BYOK (Bring Your Own Key)**: no platform-wide fallback credentials for AI,
  CRM, or voice — each bot must configure its own, or that feature is disabled
  for that bot. Keys are encrypted at rest and only ever exposed to the admin
  UI as a masked "configured / not configured" flag.
- **Live agent handoff**: a `Conversation` has a `status` (`BOT` /
  `NEEDS_HUMAN` / `HUMAN`). While a human has taken over, the AI stops
  responding; the widget and admin dashboard both poll for updates.
- **Rate limiting**: two tiers per bot — a low per-visitor cap (stops one
  visitor from spamming) and a much higher per-bot ceiling (so many concurrent
  real visitors don't collide in one shared bucket).
