# HoldLight

A mobile-first climbing assistance application for blind and low-vision climbers, featuring layered route previews and real-time next-hold guidance.

[Project Website](https://yuuu-05.github.io/CPT208-ClimbProject-C2-4/) · [Demo Video](https://github.com/Yuuu-05/HoldLight/releases/tag/project-demo) · [Poster](https://yuuu-05.github.io/CPT208-ClimbProject-C2-4/assets/documents/HoldLight-Poster.pdf)

## Research

HoldLight: Making Indoor Climbing More Accessible for Blind and Low-Vision Climbers through Layered Route Preview and Real-Time Next-Hold Guidance.

## Technologies Used

- Frontend: React 18, TypeScript, Vite, React Router
- Styling: CSS, Tailwind CSS tooling, PostCSS, Autoprefixer
- Camera and guidance: Browser MediaDevices API, Web Speech API, Web Audio API, MediaPipe Pose
- Backend: Node.js, Express.js
- Database: MongoDB with Mongoose
- Authentication: JSON Web Tokens, bcrypt
- Computer vision service: Python, OpenCV, Pillow, NumPy, PyTorch, TorchVision, Detectron2
- Deployment: Docker, Nginx, Render Blueprint, GitHub Actions, Git LFS

## Project Structure

```text
HoldLight/
|-- climb-app-frontend/   # Vite + React frontend
|-- climb-app-backend/    # Express API and Python vision runtime
|-- deploy/               # Deployment examples and scripts
|-- render.yaml           # Render full-stack deployment blueprint
`-- package.json          # Root helper scripts
```

## Setup Instructions

### 1. Prerequisites

Install these tools before running the project:

- Git
- Node.js 20+
- Python 3.10+
- MongoDB connection string, for example MongoDB Atlas or a local MongoDB server

### 2. Clone the Repository

```bash
git clone https://github.com/Yuuu-05/HoldLight.git
cd HoldLight
```

Vision model weights are distributed separately in [Model Assets](https://github.com/Yuuu-05/climb-model-assets/releases/tag/v1). See [Deployment](DEPLOYMENT.md) for model configuration.

### 3. Configure Environment Variables

Create the backend environment file:

```bash
cp climb-app-backend/.env.example climb-app-backend/.env
```

Set at least these backend values in `climb-app-backend/.env`:

```env
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=replace_with_a_long_random_secret
PORT=5000
VISION_PROVIDER=xiaoxiae
```

Create the frontend environment file:

```bash
cp climb-app-frontend/.env.example climb-app-frontend/.env
```

For local development, set:

```env
VITE_API_BASE_URL=http://localhost:5000/api
VITE_ENABLE_DEV_AUTH_BYPASS=false
```

### 4. Install JavaScript Dependencies

From the repository root:

```bash
npm run install:all
```

### 5. Install Python Vision Dependencies

From the repository root:

```bash
cd climb-app-backend
python -m venv .venv
```

Windows PowerShell:

```powershell
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements-xiaoxiae.txt
```

macOS/Linux:

```bash
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -r requirements-xiaoxiae.txt
```

Then set `VISION_PYTHON_COMMAND` in `climb-app-backend/.env`:

```env
# Windows
VISION_PYTHON_COMMAND=.venv\Scripts\python.exe

# macOS/Linux
VISION_PYTHON_COMMAND=.venv/bin/python
```

### 6. Run the Application

Open two terminals from the repository root.

Terminal 1:

```bash
npm run dev:backend
```

Terminal 2:

```bash
npm run dev:frontend
```

Default local URLs:

- Frontend: <http://localhost:5173>
- Backend API: <http://localhost:5000>
- Backend health check: <http://localhost:5000/api/health>

## Build

Build the frontend production bundle:

```bash
npm run build:frontend
```

## Notes

- The backend requires a valid `MONGO_URI`; it will not start without a database connection.
- The full wall-scanning feature requires model weights and Python vision dependencies.
- Browser camera access requires HTTPS in production. Localhost works for development.
- Deployment details are available in `DEPLOYMENT.md`.
