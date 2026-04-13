## Production Deployment Guide

This project is not a frontend-only website. A full public deployment needs all of these pieces online at the same time:

- A static frontend host for `climb-app-frontend/dist`
- A public Node.js backend for `climb-app-backend/server.js`
- A real MongoDB database
- A Python runtime on the backend host for vision inference

### Alibaba Cloud single-server path

If you want the simplest full deployment on one Alibaba Cloud ECS instance, this repository now includes:

- `deploy/docker-compose.aliyun.yml`
- `deploy/Caddyfile`
- `deploy/.env.aliyun.example`
- `climb-app-backend/Dockerfile`
- `climb-app-frontend/Dockerfile`

That stack runs:

- `caddy` for HTTPS and reverse proxy
- `frontend` as a static site container
- `backend` as one Node.js + Python service container
- `mongo` as a local MongoDB container

For this path, the frontend and API share one domain and the browser talks to `/api` on the same origin. That avoids extra CORS complexity and is usually the smoothest setup for mobile users.

If you are testing on a brand-new server before the final domain is ready, you can also use the ECS public IP as a temporary HTTP entry point:

- Set `APP_DOMAIN=http://YOUR_PUBLIC_IP`
- Set `CORS_ORIGINS=http://YOUR_PUBLIC_IP`

That temporary mode is useful for smoke-testing the full stack boot path, but it is not a complete mobile launch path:

- mobile camera capture still requires HTTPS or `localhost`
- a Mainland China public domain usually requires ICP filing before formal launch

Quick start on a fresh server:

```bash
cp deploy/.env.aliyun.example deploy/.env.aliyun
docker compose --env-file deploy/.env.aliyun -f deploy/docker-compose.aliyun.yml up -d --build
```

Before you run that command:

- Point your domain A record to the ECS public IP, or decide to use the public IP temporarily for smoke testing
- Open ports `80` and `443` in the Alibaba Cloud security group
- Fill in `APP_DOMAIN`, `CORS_ORIGINS`, `ACME_EMAIL`, `JWT_SECRET`, and the MongoDB password in `deploy/.env.aliyun`

Important:

- The first backend image build can take a long time because it installs `torch` and `detectron2` dependencies
- The first warm-up after launch is also heavier because the vision runtime loads large models into memory
- If your ECS CPU and RAM are too small, the site will still work but wall scans will feel slow

### 1. Prepare the repository

- Keep the repository private until you remove tracked `.env` files and rotate any shared secrets already committed.
- Pull Git LFS model files before deploying:

```powershell
git lfs pull
```

### 2. Provision the required services

- Frontend domain, for example `https://app.example.com`
- Backend API domain, for example `https://api.example.com`
- MongoDB database, managed or self-hosted
- One backend host with Node.js 20+, Python 3.10+, enough disk for model files, and enough RAM for `torch`, `torchvision`, `detectron2`, and OpenCV

For a first real deployment, keep frontend and backend separate:

- Frontend: static hosting
- Backend: one long-running service or container
- Database: managed MongoDB

### 3. Configure the backend

Create `climb-app-backend/.env` from `climb-app-backend/.env.example` and set real values:

```env
MONGO_URI=your_real_mongodb_connection_string
JWT_SECRET=a_long_random_secret
JWT_EXPIRES_IN=7d
PORT=5000
BODY_LIMIT=12mb
VISION_PROVIDER=xiaoxiae
VISION_PYTHON_COMMAND=python
```

Install JavaScript dependencies:

```powershell
npm install --prefix climb-app-backend
```

Install Python vision dependencies:

```powershell
python -m pip install -r climb-app-backend/requirements-xiaoxiae.txt
```

Start the backend:

```powershell
npm start --prefix climb-app-backend
```

### 4. Configure the frontend

Create a production frontend env file with the public backend API URL:

```env
VITE_API_BASE_URL=https://api.example.com/api
VITE_ENABLE_DEV_AUTH_BYPASS=false
```

Install and build:

```powershell
npm install --prefix climb-app-frontend
npm run build --prefix climb-app-frontend
```

Publish the contents of `climb-app-frontend/dist` to your static host.

### 5. Enable HTTPS everywhere

Full mobile experience requires HTTPS:

- The main site must be HTTPS
- The API must be HTTPS
- Camera access in mobile browsers will not work on plain HTTP

### 6. Routing and domains

Use two public domains or subdomains:

- `https://app.example.com` for the frontend
- `https://api.example.com` for the backend

Set the frontend API base URL to the API domain.

### 7. Smoke test before public launch

Verify these paths in order:

1. Open the site on a real phone over HTTPS
2. Register a real account
3. Log in successfully
4. Grant camera permission
5. Scan a real wall photo
6. Reach route selection and route recommendation
7. Start live guidance
8. Confirm browser speech guidance works

### 8. Recommended hardening before public release

- Restrict CORS to your real frontend origin instead of leaving it fully open
- Add authentication to any expensive inference endpoints that should not be public
- Add rate limiting for `/api/vision/*`
- Add process supervision and restart policies for the backend service
- Add health checks for backend, MongoDB, and vision runtime
- Monitor CPU, RAM, request latency, and error rates
- Pin Python package versions more tightly if you want more reproducible rebuilds

### 9. Minimum architecture summary

If you want the complete user experience, you do need server-side infrastructure.

The minimum practical production stack is:

- Static frontend host
- Public Node backend host
- MongoDB
- Python vision runtime on the backend host

Spoken guidance is provided by the browser `speechSynthesis` voice on the frontend, so no separate TTS backend runtime is required.
