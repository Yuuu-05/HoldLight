# Climb Together Frontend

A Vite + React + TypeScript frontend for the CPT208 climbing project.

## What is implemented

- User registration, login, logout, onboarding profile, and profile editing
- Beginner tutorial hub: rules, equipment, terms, safety
- Accessibility hub: high contrast mode, larger text, read-aloud, voice-command prototype, focus flow preview
- Accessible climbing prototype: wall scan, difficulty selection, route recommendation, live spoken guidance, climb summary
- Community feed: create posts, view details, like, comment
- Volunteer board: create support requests, view details, express contact intent, review your sessions
- Render-ready SPA setup with rewrite rules

## Backend alignment

The uploaded backend currently exposes:

- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/logout
- GET /api/users/me
- PUT /api/users/me
- GET /api/users/me/role

Those are connected directly in the frontend.

The community, volunteer, and climb-prototype flows are implemented fully on the frontend with localStorage-backed mock data because matching backend endpoints were not included in the uploaded backend files.

## Local development

```bash
npm install
npm run dev
```

Create a `.env` file using `.env.example`.

## Render deployment

- Create a Static Site on Render
- Root directory: this frontend folder
- Build command: `npm ci && npm run build`
- Publish directory: `dist`
- Make sure the SPA rewrite in `render.yaml` is kept, otherwise refreshing nested routes will 404
