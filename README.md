# Mainframe ✳︎ Anchor

Anchor is a premium accountability agent designed to eliminate doomscrolling by introducing real financial stakes and vector memory coaching, running inside a browser-based iOS preview environment.

## Features

- **Today's Journey Map**: A visual Metro-line goal path generated dynamically. Nodes change state and glow based on task progress.
- **Debate & Consequence**: Real-time overlays debate app openings. Choosing to scroll past limits logs excuses and redirects stakes.
- **Stake Ledger**: Displays clean balances vs. total penalty money redirected to self-improvement assets with app-branded visual logs.
- **Weekly Re-planner**: Renders compliance stats, daily breakdown charts with `OK` / `FAIL` status badges, and weekly focus roadmaps.

## Architecture & Sponsors

We leveraged the core sponsors of the Agentic Dev Tools Hackathon to build a highly parallelized, full-stack agentic app:

- **InsForge**: Serves as our entire full-stack backend, hosting our Postgres database (goals, watched apps, and ledger), user auth, edge functions (`intervene`, `decide_consequence`, `weekly_replan`), realtime WebSockets, and AI gateway access.
- **Limrun**: Provides cloud mobile preview infrastructure, compiling the mobile React environment and streaming the web-based iOS simulator directly in the browser.
- **Replicas**: Enabled us to parallelize engineering work by delegating background code tasks to coding agents in sandboxed development environments.
- **Vercel**: Used to build, deploy, and scale our frontend web application.
- **Cognition / Devin**: Devin acted as our autonomous AI software engineer, helping to plan, write, and debug our components throughout development.

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run local Vite dev server:
   ```bash
   npm run dev
   ```

3. Build production bundle:
   ```bash
   npm run build
   ```
