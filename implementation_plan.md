# Multi-Tenant Chatbot Platform MVP

Build an embeddable, multi-tenant AI chatbot system with NestJS backend, NextJS admin panel, vanilla JS widget, and Gemini-powered RAG.

## Project Structure

```
ai_chatbot/
├── backend/            # NestJS API server
│   ├── src/
│   │   ├── auth/       # API key guard + JWT auth
│   │   ├── bot/        # Bot CRUD
│   │   ├── knowledge/  # Knowledge chunk CRUD
│   │   ├── chat/       # Chat endpoint (widget → AI)
│   │   ├── ai/         # Gemini AI service + RAG
│   │   ├── widget/     # Serves widget.js
│   │   └── common/     # Guards, decorators, DTOs
│   └── ...
├── admin/              # NextJS admin panel
│   └── src/app/        # App router pages
└── widget/             # Chat widget source (built → served by backend)
```

## Database Schema (TypeORM + PostgreSQL)

```
User: id, email, password_hash, created_at
Bot: id, user_id (FK), name, api_key, is_human_active (future), created_at
Knowledge: id, bot_id (FK), content (text), created_at
Conversation: id, bot_id (FK), session_id, created_at
Message: id, conversation_id (FK), role (user|bot|agent), content, created_at
```

> [!NOTE]
> Simple RAG: No vector embeddings. We fetch all knowledge chunks for a bot and inject them into the Gemini prompt as context. This keeps the MVP fast and simple.

---

## Proposed Changes

### 1. Backend (NestJS)

#### [NEW] `backend/` — NestJS project

Initialize with `npx @nestjs/cli new backend` and install:
- `@nestjs/typeorm`, `typeorm`, `pg` — PostgreSQL
- `@google/genai` — Gemini API
- `bcrypt`, `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt` — Auth
- `uuid` — API key generation
- `class-validator`, `class-transformer` — DTO validation
- `@nestjs/serve-static` — Serve widget.js

**Modules:**

| Module | Purpose |
|--------|---------|
| `AuthModule` | JWT login/register for admin, API key guard for widget |
| `BotModule` | CRUD bots (scoped to user) |
| `KnowledgeModule` | CRUD knowledge chunks (scoped to bot) |
| `ChatModule` | `POST /chat` — receives user message, returns AI response |
| `AiModule` | Gemini API integration with simple RAG prompt |
| `WidgetModule` | Serves `widget.js` at `GET /widget.js` |

**Key endpoints:**

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/auth/register` | None | Register admin user |
| POST | `/auth/login` | None | Login, returns JWT |
| GET | `/bots` | JWT | List user's bots |
| POST | `/bots` | JWT | Create bot |
| GET | `/bots/:id` | JWT | Get bot details |
| DELETE | `/bots/:id` | JWT | Delete bot |
| POST | `/bots/:id/knowledge` | JWT | Add knowledge chunk |
| GET | `/bots/:id/knowledge` | JWT | List knowledge |
| DELETE | `/knowledge/:id` | JWT | Delete knowledge chunk |
| POST | `/chat` | API Key | Widget sends message, gets AI response |
| GET | `/widget.js` | None | Serves embeddable script |

---

### 2. Admin Panel (NextJS)

#### [NEW] `admin/` — NextJS App Router project

Initialize with `npx create-next-app@latest ./admin`.

**Pages:**

| Route | Purpose |
|-------|---------|
| `/login` | Login form |
| `/register` | Register form |
| `/dashboard` | List bots, create new bot |
| `/bots/[id]` | Bot detail: name, API key, embed code, manage knowledge |

**Design:** Dark theme, minimal, clean cards. Uses `fetch` to call backend API.

---

### 3. Chat Widget (Vanilla JS)

#### [NEW] `widget/` — Source for embeddable chat bubble

- Single `widget.js` file bundled and served by backend
- Floating bubble in bottom-right corner
- Expandable chat window with message history
- Sends messages via `POST /chat` with API key in header
- Embed format: `<script src="http://localhost:3000/widget.js" data-bot-key="BOT_API_KEY"></script>`

---

### 4. AI Service (Gemini RAG)

Simple RAG flow:
1. Receive user message + bot API key
2. Fetch all knowledge chunks for that bot from DB
3. Build prompt: `"Answer based only on this context:\n{chunks}\n\nUser: {message}"`
4. Call Gemini API (`gemini-2.0-flash`)
5. Return response

---

### 5. Future-Proofing

- `Bot.is_human_active` field — prepared for live agent handoff
- `Message.role` supports `'agent'` — for human agent messages
- AI service is abstracted behind an interface for easy swap/extension

---

## Verification Plan

### Automated (Backend)

```bash
cd backend && npm run test
```
We'll write basic unit tests for the AI service and chat controller.

### Manual End-to-End Test

1. **Start PostgreSQL** — ensure a local instance is running
2. **Start backend**: `cd backend && npm run start:dev` → should listen on `http://localhost:3000`
3. **Start admin**: `cd admin && npm run dev` → should listen on `http://localhost:3001`
4. **Register** an admin user via the admin panel
5. **Login** and create a bot — verify bot_id and API key are displayed
6. **Add knowledge** — paste some FAQ text
7. **Copy embed code** from bot detail page
8. **Create a test HTML file** with the embed script — open in browser
9. **Send a message** via the widget — verify AI responds using the knowledge context
10. **Verify multi-tenancy** — create a second bot with different knowledge, verify responses are isolated

> [!IMPORTANT]
> You must set `GEMINI_API_KEY` in `backend/.env` for AI responses to work. You also need PostgreSQL running locally with a database created.
