# 🤖 AI Chatbot Platform

A multi-tenant AI chatbot platform with embeddable widget, admin panel, and Gemini-powered RAG.

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Any Website │     │ Admin Panel  │     │  PostgreSQL   │
│  (Widget.js) │     │   (NextJS)   │     │   Database    │
└──────┬───────┘     └──────┬───────┘     └──────▲───────┘
       │ REST                │ REST                │
       │ x-bot-api-key       │ JWT Bearer          │ TypeORM
       │                     │                     │
       └─────────┬───────────┘                     │
                 │                                 │
          ┌──────▼───────┐     ┌──────────────┐    │
          │   NestJS     │────▶│  Gemini AI   │    │
          │   Backend    │     │   (RAG)      │    │
          │  :3000       │─────┘              │    │
          └──────────────┘                    ▼    │
                 │                                 │
                 └─────────────────────────────────┘
```

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL running locally
- Gemini API key

### 1. Setup Database
```bash
createdb ai_chatbot
```

### 2. Start Backend
```bash
cd backend
cp .env.example .env
# Edit .env with your GEMINI_API_KEY and DB credentials
npm run start:dev
```
Backend runs on `http://localhost:3000`

### 3. Start Admin Panel
```bash
cd admin
npm run dev
```
Admin panel runs on `http://localhost:3001`

### 4. Usage
1. Open `http://localhost:3001/register` → create an account
2. Login → create a bot
3. Add knowledge text (FAQ, product info, etc.)
4. Copy the embed code from the bot detail page
5. Paste into any HTML page or WordPress site

### Embed Code
```html
<script src="http://localhost:3000/widget.js" data-bot-key="YOUR_API_KEY"></script>
```

### Test Widget
Open `test-widget.html` in a browser (update the API key first).

## Tech Stack
- **Backend**: NestJS + TypeORM + PostgreSQL
- **Admin**: Next.js (App Router)
- **Widget**: Vanilla JS (embeddable)
- **AI**: Google Gemini 2.0 Flash (simple RAG)
- **Auth**: JWT (admin) + API Key (widget)

## Project Structure
```
ai_chatbot/
├── backend/           # NestJS API
│   ├── src/
│   │   ├── auth/      # JWT + API key auth
│   │   ├── bot/       # Bot CRUD
│   │   ├── knowledge/ # Knowledge chunk CRUD
│   │   ├── chat/      # Chat endpoint + message storage
│   │   ├── ai/        # Gemini AI service
│   │   └── widget/    # Widget.js serving
│   └── public/
│       └── widget.js  # Embeddable chat widget
├── admin/             # Next.js admin panel
│   └── src/app/
│       ├── login/     # Login page
│       ├── register/  # Register page
│       ├── dashboard/ # Bot list + create
│       └── bots/[id]/ # Bot detail + knowledge mgmt
└── test-widget.html   # Widget test page
```
