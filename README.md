# 🤖 Nimits-Jarvis

**Your 100% Local, 24/7 Personal AI Agent — Operating Securely at Zero Cost.**

`Nimits-Jarvis` is a secure, self-hosted personal AI assistant built on top of **Next.js 15**, **Composio**, and **Vercel AI SDK**. By utilizing open-source models locally via **Ollama** or cloud models via **OpenRouter**, this system runs continuously, remembers everything that matters, and automates your digital life — with full multi-project isolation and multi-chat threading.

---

## ✨ Features

### Core Intelligence
- 🧠 **Multi-Gateway Models:** Run local models (Ollama `qwen3:8b`) or cloud models via **OpenRouter** and **Vercel AI Gateway** — each chat can use a different model, retained across sessions
- 💾 **Semantic Memory (pgvector):** Persistent memory storage using `384`-dimension vectors, shared across all chats within a project
- 💤 **Cron Jobs:** Schedule recurring background tasks tied to specific chats — hardened against prompt injection via context isolation
- 🧠 **3-Layer Context Management:** Auto-pruning → memory flush → context compaction ensures infinite conversations without context overflow

### Multi-Project & Multi-Chat
- 🗂 **Project Isolation:** Each project has its own encrypted Composio API key, isolated connections, and independent settings (PII, gateways, Telegram)
- 💬 **Multi-Chat Threading:** Organize work across multiple concurrent chat threads within a project — each with its own model, context window, and compaction state
- 🔄 **Concurrent Streaming:** Multiple chats can stream agent responses simultaneously across projects
- 📱 **Three-Panel UI:** Left sidebar (chat list + search + create/rename/delete) | Center (Chat view with model selector) | Right (Terminal showing tool execution logs)
- 📛 **Auto-Naming:** New chats automatically named from the first message; rename anytime via the sidebar

### Security & Privacy
- 🛡 **Robust PII Protection (6-Layer Defense):** When using cloud models, sensitive data is tokenized and redacted at every tier — tool results, context messages, system prompts, and the transport stream itself. SSE chunk-boundary buffering ensures no token leaks mid-stream
- 🔐 **Per-Project Encryption:** Each project's Composio API key is AES-256-GCM encrypted at rest; no shared keys between projects
- ⛓ **Composio Sandboxing:** Code execution runs inside Composio's remote workbench sandboxes, protecting your host machine
- 🔑 **OAuth-First:** The agent accesses services through OAuth flows — no raw service credentials exposed

### Communication
- 💬 **Omnichannel:** Chat via the Next.js Web Dashboard or **Telegram Bot** — each Telegram message auto-creates a new chat thread
- 🎙 **Whisper Voice Mode:** Integrated speech-to-text via **Whisper** with custom Jarvis-themed orb UI — scoped per-chat, with text-optimized response rendering

### Quality of Life
- 🔍 **Chat Search:** Search across all messages in a project by content
- ⚡ **Stream Reconnection:** Redis-backed resumable streams survive page refreshes
- 🌓 **Dark Mode:** Full light/dark theme support via shadcn/ui theming
- 🔒 **Auth:** Better Auth with username/password; no OAuth providers needed

---

## 🏗 System Architecture

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                                   Client Interfaces                                      │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌────────────────────────────────┐  │
│  │   Web Dashboard      │  │   Telegram Bot       │  │   Whisper Voice (Jarvis Orb)  │  │
│  │  (Next.js 15 + tRPC) │  │   (Telegram API)     │  │   (STT → Chat)                │  │
│  └──────────┬───────────┘  └──────────┬───────────┘  └───────────────┬────────────────┘  │
└─────────────┼─────────────────────────┼──────────────────────────────┼──────────────────┘
              │                         │                              │
   ┌──────────▼──────────┐   ┌──────────▼──────────┐   ┌───────────────▼────────────────┐
   │  /api/chat (POST)   │   │  /api/telegram-     │   │  /api/transcribe              │
   │  Agent streaming    │   │  webhook            │   │  (Whisper → text)             │
   │  + PII SSE buffer   │   │  Auto-create chat   │   │                               │
   └──────────┬──────────┘   └──────────┬──────────┘   └───────────────┬────────────────┘
              │                         │                              │
              └─────────────────────────┼──────────────────────────────┘
                                        │
              ┌─────────────────────────▼──────────────────────────────────────┐
              │                    prepareAgentRun()                           │
              │                  (Agent Orchestrator)                          │
              │                                                                │
              │  1. Load Project (instance) + Chat → per-chat model selection  │
              │  2. Build System Prompt (identity + soul + user + memories)    │
              │  3. Create PII Vault (for non-local models)                    │
              │  4. Load & Prune Context (scoped to chat)                      │
              │  5. Create Composio Session (per-project API key + entity ID)  │
              │  6. Wrap Tools (Unicode sanitize + PII redact executors)       │
              │  7. Build ToolLoopAgent (20-step limit)                        │
              └─────────────────────────┬──────────────────────────────────────┘
                                        │
     ┌──────────────────────────────────┼──────────────────────────────────┐
     │                                  │                                  │
     ▼                                  ▼                                  ▼
┌──────────────┐              ┌───────────────────┐           ┌───────────────────────┐
│  Local LLM   │              │   Cloud LLMs      │           │   Composio Router     │
│  (Ollama)    │              │  OpenRouter /     │           │  OAuth → Tools        │
│  No PII layer│              │  Vercel Gateway   │           │  Gmail, Slack, GitHub  │
│              │              │  + PII Redaction  │           │  Notion, Jira, etc.   │
└──────┬───────┘              └────────┬──────────┘           └───────────┬───────────┘
       │                               │                                  │
       └───────────────────────────────┼──────────────────────────────────┘
                                       │
              ┌────────────────────────▼──────────────────────────────────┐
              │                  Post-Response (fire-and-forget)          │
              │                                                           │
              │  1. PII Restore (tokens → real values) → save to DB       │
              │  2. Memory Flush (pre-compaction, if threshold reached)   │
              │  3. Context Compaction (summarize, if context overflows)  │
              │  4. Clear streaming state (Redis)                         │
              └───────────────────────────────────────────────────────────┘
```

### Multi-Project Architecture

```
User
 ├── Project "Default" (API Key: ak_VE83S0...)
 │    ├── Composio Entity: instance-id-1
 │    ├── Settings: PII enabled, Vercel Gateway on
 │    ├── Chat "First chat" (model: claude-sonnet-4-5, 152 messages)
 │    │    ├── Compaction state (compactionCount=3, summary="...")
 │    │    └── Messages (scoped to chatId)
 │    └── Chat "Research" (model: qwen3:8b, 0 messages)
 │
 └── Project "Nimits Personal" (API Key: ak_qASkF3o...)
      ├── Composio Entity: instance-id-2
      ├── Settings: PII enabled, OpenRouter Gateway on
      ├── Chat "First chat" (model: openrouter/deepseek-v4-flash, 8 messages)
      │    └── Gmail connection → your@email.com
      └── Chat "Automation" (model: gpt-4o)
           └── Cron job: daily summary @ 9am
```

### Three-Panel Dashboard UI

```
┌──────────────┬──────────────────────────────────┬─────────────────┐
│ 280px        │            flex-1                │  400-500px      │
│              │                                  │                 │
│ [+ New Chat] │   ┌────────────────────────┐     │  Terminal       │
│ [Search...]  │   │  Chat Messages         │     │  ────────────   │
│              │   │  (Virtuoso virtualized)│     │  Tool logs      │
│  Chat 1 ──── │   │                        │     │  Execution      │
│  Chat 2      │   │  User: "..."           │     │  traces         │
│  Chat 3      │   │  AI: "..."             │     │                 │
│  ⋮           │   │  [Tool: Gmail fetch]   │     │  GMAIL_FETCH    │
│              │   └────────────────────────┘     │  → 5 emails     │
│  [⋮] Rename  │   ┌────────────────────────┐     │                 │
│      Delete  │   │  Chat Input + Model ▾  │     │  MEMORY_SAVE    │
│              │   │  [Mic] [Send]          │     │  → saved        │
│              │   └────────────────────────┘     │                 │
└──────────────┴──────────────────────────────────┴─────────────────┘
```

### PII Protection — 6-Layer Defense

```
Tool Results ──► Deep-Walk JSON Scanner ──► Structured PII Extraction
                                               │
Context Messages ──► Redaction Pass ───────────┤
                                               │
System Prompt ──► Identity/Soul scrub ─────────┤
                                               ▼
                                     ┌─────────────────┐
                                     │   PII Vault     │
                                     │  [EMAIL_1] ↔    │
                                     │  user@email.com │
                                     └────────┬────────┘
                                              │
                       ┌──────────────────────┼──────────────────────┐
                       ▼                      ▼                      ▼
              Tool Result Redact    Context Redact          System Prompt Scrub
                       │                      │                      │
                       └──────────────────────┼──────────────────────┘
                                              │
                                    ┌─────────▼─────────┐
                                    │ Transport Shield  │
                                    │ (Network-layer    │
                                    │  final checkpoint)│
                                    └─────────┬─────────┘
                                              │
                                    ┌─────────▼─────────┐
                                    │  SSE Stream with  │
                                    │  Chunk-Boundary   │
                                    │  Buffered Restore │
                                    │  [EMAIL_1]→real   │
                                    └───────────────────┘
```

---

## 🗄 Database Schema

| Model | Table | Purpose |
|---|---|---|
| **User** | `user` | Auth user (Better Auth username/password) |
| **Session** | `session` | Auth session (30-day expiry) |
| **ComposioClawInstance** | `composio_claw_instance` | **Project** — API key, PII/gateway settings, identity prompts, Telegram link |
| **Chat** | `composio_claw_chat` | **Thread** — per-chat model, compaction state, scoped messages |
| **Message** | `composio_claw_message` | Chat messages scoped to `chatId` + `instanceId` |
| **Memory** | `composio_claw_memory` | pgvector semantic memories (384-dim, shared within instance) |
| **CronJob** | `composio_claw_cron_job` | Scheduled tasks (scoped to chat) |
| **OnboardingState** | `onboarding_state` | Onboarding wizard progress |

---

## 🚀 Getting Started

### 1. Prerequisites
- [Node.js (v18+)](https://nodejs.org) and [PNPM](https://pnpm.io)
- [Ollama](https://ollama.com) (for local LLM and embedding generation)
- [PostgreSQL](https://postgresql.org) with the `pgvector` extension enabled
- [Redis](https://redis.io) (optional — enables resumable streams; basic streaming works without it)

### 2. Pull Open Source Models
```bash
ollama pull qwen3:8b
ollama pull qllama/bge-small-en-v1.5
```

### 3. Setup
```bash
git clone https://github.com/Nimit-Shah/nimits-jarvis.git
cd nimits-jarvis
pnpm install
cp .env.example .env
```

Edit `.env` and fill in:
- `DATABASE_URL` — PostgreSQL connection string
- `BETTER_AUTH_SECRET` — `openssl rand -base64 32`
- `COMPOSIO_API_KEY` — Get from [Composio Dashboard](https://dashboard.composio.dev/)
- `ENCRYPTION_KEY` — `openssl rand -hex 32` (for at-rest API key encryption)
- `OPENROUTER_API_KEY` — Get from [OpenRouter](https://openrouter.ai/) (optional, for cloud models)
- `AI_GATEWAY_API_KEY` — Vercel AI Gateway key (optional, for local dev)

### 4. Per-Project API Keys (Project Isolation)
Each project stores its own encrypted Composio API key in the database. To set up per-project keys:
```bash
pnpm prisma db push
```
Then encrypt and store per-project keys via a migration script. This ensures each project has fully isolated connections — project A's Gmail won't leak into project B.

### 5. Run
```bash
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000) and complete the onboarding wizard.

---

## 🛡 Security Design

- **Zero Local Execution:** Code runs inside Composio's sandboxes — host machine protected from prompt injection
- **OAuth-First:** No raw service keys visible to the agent; all access through Composio OAuth brokers
- **PII Encryption (6 Layers):**
  1. **Structured PII Extraction** — Deep-walks JSON tool results for known fields (name, email, phone, profileUrl, URNs)
  2. **Tool-Output Redaction** — All string values in tool results are redacted against registered PII
  3. **Context Message Redaction** — Historical turns are fully redacted using deterministic tokens
  4. **System Prompt Scrub** — Identity/soul prompts (which may contain user PII) are redacted
  5. **Transport-Layer Shield** — Network-level deep-scrub of the entire compiled payload before LLM
  6. **SSE Chunk-Boundary Restore** — Buffered transform stream ensures no `[EMAIL_1]` leaks mid-chunk; tokens restored to real values on return
- **Project Isolation:** Each project has its own AES-256-GCM encrypted Composio API key; no shared keys, no connection leakage between projects
- **Per-Chat Model Selection:** Each chat can use a different model; model retained across chat switches

---

## 🏛 Architecture Principles

- **One thing per file** — One component, one procedure, one schema per file
- **Type safety end-to-end** — Zod schemas define contracts, TypeScript enforces them
- **Mobile-first** — Every page responsive; sidebar becomes slide-over on mobile
- **Co-location** — Related files live together (skeletons with components, schemas with procedures)
- **Maximally use shadcn/ui** — Minimal custom CSS; theme-aware color variables

---

## 📝 License

Distributed under the MIT License. See `LICENSE` for more information.