# Northflank deployment

This repository is ready for Northflank with one frontend service, one backend service, and one managed MongoDB addon.

## Recommended architecture

- `frontend`: Docker image from `climb-app-frontend/Dockerfile`
- `backend`: Docker image from `climb-app-backend/Dockerfile`
- `mongodb`: Northflank MongoDB addon in the same region
- one shared public domain such as `https://climb.example.com`
- path routing:
  - `/` -> frontend port `80`
  - `/api` -> backend port `5000`

Keep every service in the same Northflank region. For users in China, start with `asia-northeast`. If that is not available for your account, use the nearest Asia region Northflank offers to you.

## Why GHCR images instead of direct Git deploy

The backend image contains large Git LFS model weights. Not every hosted Git build path handles Git LFS the same way.

The safest path is:

1. push this repository to GitHub
2. run the GitHub Actions workflow `.github/workflows/publish-ghcr-images.yml`
3. deploy the published GHCR images on Northflank

That workflow checks out Git LFS assets, builds both images, and publishes:

- `ghcr.io/<github-owner>/climb-app-frontend:latest`
- `ghcr.io/<github-owner>/climb-app-backend:latest`

If your repository is private, either make the GHCR packages public or create a GitHub personal access token with `read:packages` and add it to Northflank as registry credentials.

## 1. Publish Docker images

Run the GitHub Actions workflow `Publish GHCR Images`.

After it succeeds, confirm both images exist in GHCR.

## 2. Create the Northflank project

Create one new project for the climb app.

## 3. Add MongoDB

Create a MongoDB addon in the same region as the services.

Recommended starting point:

- MongoDB 7
- TLS enabled
- at least 20 GB storage

Copy the connection string and use it as `MONGO_URI` for the backend service.

## 4. Create the backend service

Create a new service from a container image:

- image: `ghcr.io/<github-owner>/climb-app-backend:latest`
- port: `5000`
- protocol: HTTP
- health check path: `/api/health`

Recommended starting resources for a 4-user internal test:

- 4 vCPU
- 16 GB RAM
- 1 replica

Set environment variables from `deploy/northflank/backend.env.example`.

At minimum you must set:

- `MONGO_URI`
- `JWT_SECRET`
- `CORS_ORIGINS`

For a same-domain deployment:

- `CORS_ORIGINS=https://climb.example.com`
- `VISION_INFER_WORKERS=1`
- `VISION_CALIBRATION_WORKERS=2`

## 5. Create the frontend service

Create another service from a container image:

- image: `ghcr.io/<github-owner>/climb-app-frontend:latest`
- port: `80`
- protocol: HTTP
- health check path: `/`

Recommended starting resources:

- smallest paid always-on instance
- 1 replica

No runtime environment variables are required when you deploy the published GHCR image, because the frontend image is already built with `VITE_API_BASE_URL=/api`.

## 6. Attach the public domain

Use one custom domain if you want the cleanest mobile experience.

Attach the same public domain to both services with path-based routing:

- route `/api` to the backend service on port `5000`
- route `/` to the frontend service on port `80`

This keeps frontend and backend on the same origin and avoids extra CORS problems on mobile browsers.

## 7. Smoke test

Verify in this order:

1. open `https://climb.example.com`
2. register and log in
3. grant camera permission on a real phone
4. upload or scan a wall photo
5. start live guidance
6. confirm spoken guidance works
7. test two phones, then four phones

## 8. Operational notes

- scale the backend vertically before scaling it horizontally
- keep MongoDB and backend in the same region
- do not use free or sleeping instances for the backend
- if backend image builds fail with a vision asset error, Git LFS assets were not present during image build
