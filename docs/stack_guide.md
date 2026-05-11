# Sastech Jarvis Orchestrator: Tech Stack & Implementation Guide

This document outlines the pure code-driven blueprint for building the "Jarvis Command Center" utilizing the custom tech stack, without relying on visual workflow builders like n8n.

---

## 1. The Core Tech Stack

This stack guarantees absolute control over every agent, relying purely on Python data structures, state machines, and React interfaces.

### 🔹 Frontend (The Command Center & Mobile Hub)
* **Stack:** React (Web Dashboard) & React Native (Mobile App)
* **Role:** Serves as the Universal Memory Dump and real-time execution log viewer. React Native ensures you can dump memories on the go.

### 🔹 The Orchestrator & Execution Engine (The Brain & Muscle)
* **Stack:** Python 3.11 + FastAPI + LangGraph
* **Role:** FastAPI exposes the endpoints (`/api/ingest`). LangGraph orchestrates the complex multi-agent workflows.
* **Why LangGraph?:** Instead of passing webhooks around, LangGraph allows us to define agents as nodes in a graph with shared state. This means the `DocUpdater` and `JobApplicator` can share memory and correct each other autonomously.

### 🔹 Database & Storage
* **Stack:** Supabase (PostgreSQL + pgvector for semantic search)
* **Role:** Master record for the "Memory Log", user states, project management, CV history, and agent execution logs.

---

## 2. Architecture & Data Flow

1. **User Input:** You submit an update via the React Native app or React dashboard.
2. **API Layer:** A POST request hits your FastAPI backend (`/api/ingest`).
3. **LangGraph State Initialization:** FastAPI initializes a LangGraph state dictionary with your memory payload.
4. **The Supervisor Node:** The graph routes the state to the Supervisor Agent (powered by Claude 3 Opus/GPT-4o).
5. **Agent Execution (Nodes):** 
   - The Supervisor invokes specialized LangGraph nodes (e.g., `CV_Updater_Node`, `Job_Scraper_Node`).
   - These nodes run pure Python code (e.g., calling the Google Docs API using the Google Python SDK, or scraping jobs using BeautifulSoup/Selenium).
6. **State Sync:** Every node updates the Supabase `execution_logs` table via the Supabase Python SDK, which the React frontend listens to in real-time.

---

## 3. Feature Implementations (LangGraph Agents)

### A. Auto-Document & CV Updater Agent
* **Sub-Features:** CV Auto-generation, Cover Letter Generator.
* **Implementation:** 
  - A LangGraph node that receives the new skill.
  - Pulls your existing CV JSON structure from Supabase.
  - Rewrites the JSON to include the new skill.
  - Uses `python-docx` or LaTeX compilers to generate a fresh PDF.
  - Uploads the PDF to Supabase Storage and returns the public link.

### B. Portfolio Syncer Agent
* **Sub-Features:** Case Study Generator, GitHub Committer.
* **Implementation:** 
  - Generates a Markdown case study of the project.
  - Uses the `PyGithub` library to automatically create a pull request or commit directly to your Portfolio's repository, triggering a live deployment.

### C. Job Applicator Agent
* **Sub-Features:** Job Board Scraper, Match Analyzer, Email Outreach.
* **Implementation:** 
  - Uses `httpx` and `BeautifulSoup` to scrape remote job APIs (e.g., YCombinator, Wellfound).
  - Uses LLMs to compare the job description against your newly updated CV in Supabase.
  - If a match > 80% is found, it uses the `smtplib` or Google Gmail API in Python to draft and send a tailored cover letter with the CV attachment.

### D. Content & PR Publisher Agent
* **Sub-Features:** Multi-platform formatting, API Scheduler.
* **Implementation:** 
  - Generates threads/posts.
  - Uses Python libraries to directly hit the LinkedIn REST API and Twitter v2 API to schedule and publish the content.

### E. GoalFlow (Project Management) Agent
* **Sub-Features:** Task extraction, timeline updates.
* **Implementation:** 
  - Updates the `projects` table in Supabase, dynamically calculating timelines and flagging dependencies based on your daily memory updates.

---

## 4. Step-by-Step Implementation Guide

### Phase 1: Database & Frontend Foundation
1. Set up Supabase with tables: `memories`, `execution_logs`, `cv_state`, `projects`.
2. Scaffold a React interface (or React Native app) that allows you to POST to your backend and subscribes to `execution_logs` using Supabase Realtime subscriptions.

### Phase 2: FastAPI & Supervisor Setup
1. Scaffold the FastAPI app.
2. Integrate LangGraph: define a `State` TypedDict containing `memory_text`, `cv_updates`, `jobs_to_apply`, and `social_posts`.
3. Create the Supervisor Node that analyzes the `memory_text` and populates the state routing.

### Phase 3: Building the Python Agent Nodes
1. Write the Python code for the `Content Publisher` node (hitting LinkedIn API).
2. Write the Python code for the `CV Updater` node (manipulating documents and Supabase storage).
3. Connect these nodes into the LangGraph workflow so the Supervisor can trigger them sequentially or in parallel.

### Phase 4: Job Scraping & Autonomous Execution
1. Implement the job scraper scripts within the LangGraph ecosystem.
2. Connect email delivery capabilities.
3. Deploy the FastAPI app to a cloud provider (e.g., Render, Railway, AWS ECS) that supports long-running Python background processes, as scraping and API interactions can take several minutes per run.
