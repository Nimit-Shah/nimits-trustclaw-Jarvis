# 🤖 nimits-trustclaw-Jarvis

**Your 100% Local, 24/7 Personal AI Agent — Operating Securely at Zero Cost.**

`nimits-trustclaw-Jarvis` is a secure, self-hosted personal AI assistant built on top of **TrustClaw** and **Composio**. By utilizing open-source models locally via **Ollama**, this system runs continuously, remembers everything that matters, and automates your digital life without costing a single rupee in API bills.

---

## 🎯 The Aim
To run a robust, **24x7 personal agent** on your local machine using state-of-the-art **open-source AI models** (Ollama `qwen3:8b` and `qllama/bge-small-en-v1.5` embeddings) or cloud models via **OpenRouter** and **Vercel AI SDK**. Integrated with **Composio** to securely authenticate and control external services (Slack, Gmail, GitHub, Notion, etc.) via OAuth, all protected by a robust **PII Encryption Layer** that ensures your personal data never leaks to external models.

---

## ✨ Features

* 🔌 **Composio OAuth Integration:** Securely connect and control over 1,000+ external apps and services using Composio. No raw API keys are ever exposed to the agent.
* 🧠 **Multi-Gateway Intelligence:** Powered by local models (Ollama) or external cloud models via **OpenRouter** and **Vercel AI SDK**, offering ultimate flexibility and choice.
* 🛡 **PII Protection Layer:** When using cloud models, sensitive data (emails, phone numbers, names) is automatically redacted before leaving your machine and restored upon response. Local models bypass this for speed.
* 💾 **Semantic Memory:** Persistent memory storage using Postgres and `pgvector` with `384`-dimension vectors.
* 💤 **Auto-Autopilot (Cron Jobs):** Schedule recurring background tasks (e.g. daily summaries, inbox cleaning, automated reports) that trigger the agent 24/7.
* 🔐 **Privacy-First & Secure:** Sensitive credentials stay encrypted. Destructive scripts are locked within Composio's sandboxed environment.
* 💬 **Omnichannel:** Chat with your agent via the next-generation Next.js Web Dashboard or link it directly to a **Telegram Bot** for on-the-go automation.

---

## 🏗 System Architecture

```
                                  ┌───────────────────────────┐
                                  │      Client Interfaces    │
                                  │   (Web Dashboard / TG)    │
                                  └─────────────┬─────────────┘
                                                │
                                                ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 Local Machine / Server                                 │
│                                                                                        │
│   ┌───────────────────────┐         ┌────────────────────┐         ┌───────────────┐   │
│   │    Next.js Backend    │◄───────▶│  PII Encryption    │◄───────▶│ Postgres DB   │   │
│   │ (tRPC & Agent Loop)   │         │       Layer        │         │  (pgvector)   │   │
│   └───────────┬───────────┘         └─────────┬──────────┘         └───────────────┘   │
│               │                               │                                        │
│               │                      ┌────────┴────────┐                               │
│               │                      ▼                 ▼                               │
│               │             ┌─────────────────┐ ┌────────────────┐                     │
│               │             │   Local LLMs    │ │   Cloud LLMs   │                     │
│               │             │(Ollama Engine)  │ │ (OpenRouter /  │                     │
│               │             │                 │ │ Vercel AI SDK) │                     │
│               │             └─────────────────┘ └────────────────┘                     │
└───────────────┼────────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌───────────────────────────┐
│     Composio Router       │
│  (OAuth Brokers & Tools)  │
└───────────────────────────┘
```

---

## 🚀 Getting Started

Follow these steps to spin up your 100% local, zero-cost personal agent.

### 1. Prerequisites
Ensure you have the following installed on your machine:
* [Node.js (v18+)](https://nodejs.org) and [PNPM](https://pnpm.io)
* [Ollama](https://ollama.com) (for local LLM and embedding generation)
* [PostgreSQL](https://postgresql.org) with the `pgvector` extension enabled

### 2. Pull the Open Source Models
Open your terminal and pull the text generation and embedding models:
```bash
# Pull the Qwen-3 8B instruct model
ollama pull qwen3:8b

# Pull the BGE Small English embedding model (384-dimensions)
ollama pull qllama/bge-small-en-v1.5
```

### 3. Setup Project Configuration
Clone this repository and configure your environment variables:
```bash
# Clone the repository (if not already cloned)
git clone https://github.com/Nimit-Shah/nimits-trustclaw-Jarvis.git
cd nimits-trustclaw-Jarvis

# Install dependencies
pnpm install

# Copy env template
cp .env.example .env
```

Edit the `.env` file and fill in:
* `DATABASE_URL`: Your PostgreSQL connection string (e.g., `postgresql://user:pass@localhost:5432/trustclaw`)
* `BETTER_AUTH_SECRET`: Generate a random signing key (e.g., `openssl rand -base64 32`)
* `COMPOSIO_API_KEY`: Get a free developer API key from [Composio Dashboard](https://dashboard.composio.dev/)
* `OLLAMA_BASE_URL`: Defaults to `http://localhost:11434`
* `OPENROUTER_API_KEY`: Get an API key from [OpenRouter](https://openrouter.ai/) if you plan to use external cloud models.

### 4. Migrate the Database Schema
Push the schema to your Postgres instance. This sets up the message logs, scheduling tables, and the `384`-dimension pgvector memory schema:
```bash
pnpm prisma db push
```

### 5. Run the Local Server
Start the development server:
```bash
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000) to complete the onboarding and start interacting with your Jarvis agent!

---

## 🛡 Security Design

* **Zero Local System Execution:** Any code execution or complex scripting performed by tools runs inside Composio's remote workbench sandboxes, keeping your host machine safe from prompt injection attacks.
* **OAuth Credentials Protection:** The agent executes transactions through OAuth flows managed by Composio. No direct service keys (e.g., Google OAuth keys, GitHub personal tokens) are visible to the agent's code context.
* **PII Encryption & Redaction (Defense-in-Depth):** TrustClaw deploys a multi-layered anonymization process to protect your data before it leaves your network:
  1. **Tool-Output Redaction:** Incoming results from 500+ third-party tools are intercepted and scrubbed.
  2. **Deep-Walk Scanner Heuristic:** Scans raw JSON key names (like `name`, `email`, `phone`) at any nesting depth to catch PII in arbitrary tool schemas.
  3. **Context Message Redaction:** Historical dialogue turns are fully redacted using session-isolated, deterministic placeholders.
  4. **Transport-Layer Shield (Final Checkpoint):** Sits as a network-level bottleneck right before serialization, deep-scrubbing the entire compiled payload (including instructions, system prompts, and history) to catch any edge-case leaks.
  5. **SSE Response Reconstruction:** An intercepting transform stream maps these tokens back to your original data on the way to the frontend, ensuring you see clean, unredacted outputs while keeping external LLMs completely blind to your sensitive data. Local models bypass this for speed.

---

## 📝 License
Distributed under the MIT License. See `LICENSE` for more information.
