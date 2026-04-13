# CPT208 Climb App

Private team repository for the CPT208 climbing app project.

This repo contains:

- `climb-app-frontend`: Vite + React frontend
- `climb-app-backend`: Express + MongoDB backend
- shared team `.env` files for the current private development workflow
- xiaoxiae vision model weights tracked with Git LFS

## Keep this repo private

The current team workflow tracks shared development `.env` files in Git so teammates can clone and run quickly.
If this repository is ever made public, remove the committed `.env` files and rotate the affected secrets immediately.

## Quick start

1. Install Node.js 20+, Python 3.8+, Git, and Git LFS.
2. Enable Git LFS once on your machine:

   ```bash
   git lfs install
   ```

3. Clone the repo and pull LFS model files:

   ```bash
   git clone https://github.com/Yuuu-05/CPT208-ClimbApp.git
   cd CPT208-ClimbApp
   git lfs pull
   ```

4. Install JavaScript dependencies from the repo root:

   ```bash
   npm run install:all
   ```

5. Install Python dependencies:

   Heuristic-only vision mode:

   ```bash
   python -m pip install -r climb-app-backend/requirements-heuristic.txt
   ```

   Full xiaoxiae mode:

   ```bash
   python -m pip install -r climb-app-backend/requirements-xiaoxiae.txt
   ```

6. Start the backend and frontend in separate terminals:

   ```bash
   npm run dev:backend
   npm run dev:frontend
   ```

## Shared environment

For the current private team workflow, the repo already includes:

- `climb-app-backend/.env`
- `climb-app-frontend/.env`

If you want to stop tracking secrets later, remove them from Git and fall back to the `.env.example` files.

## Vision models

The full xiaoxiae vision mode requires these two files:

- `climb-app-backend/vision_service/models/xiaoxiae/hold_detector/model_final.pth`
- `climb-app-backend/vision_service/models/xiaoxiae/route_triplet/triplet_network_final.pt`

They are configured for Git LFS so teammates can clone the repo and fetch them directly with `git lfs pull`.

## More detail

See `TEAM_SETUP.md` for the full teammate setup guide and troubleshooting notes.
See `DEPLOYMENT.md` and `deploy/northflank/README.md` for cloud deployment paths.

## Spoken guidance

Spoken guidance now uses the browser `speechSynthesis` voice directly. No extra backend TTS service or MeloTTS environment is required.
