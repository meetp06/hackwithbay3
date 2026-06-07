# Mainframe ✳︎ Anchor

Anchor is a premium accountability agent designed to eliminate doomscrolling by introducing real financial stakes and vector memory coaching.

## Features

- **Today's Journey Map**: A visual Metro-line goal path generated dynamically using Gemini. Nodes change state and glow based on task progress.
- **Debate & Consequence**: Real-time overlays debate app openings. Choosing to scroll past limits logs excuses and redirects stakes.
- **Stake Ledger**: Displays clean balances vs. total penalty money redirected to self-improvement assets with app-branded visual logs.
- **Weekly Re-planner**: Renders compliance stats, daily breakdown charts (`OK`/`FAIL`), and weekly focus roadmaps.

## Architecture & Sponsors

- **InsForge**: Handles user database profiles, pgvector excuse logs (`openai/text-embedding-3-small`), debate completions (`anthropic/claude-3.5-haiku`), edge functions, and realtime coach broadcasts.
- **Google Gemini**: Powers the visual chronological sequencing engine for Today's Journey Map.

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
