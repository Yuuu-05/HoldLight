# Render Existing Image Path

Use this path when GitHub LFS downloads are blocked on Render and you want Render to deploy prebuilt images from GHCR instead of cloning the repository.

This repository already includes:

- `climb-app-frontend/Dockerfile`
- `climb-app-backend/Dockerfile`
- `deploy/render-image/publish-ghcr.ps1`
- `deploy/render-image/trigger-render-deploy.ps1`

## Why this path helps

Render no longer needs to clone this Git repository during deploys, so it no longer consumes Git LFS bandwidth to fetch the model files.

You build from your local machine instead:

- your local checkout already has the real LFS model files
- Docker builds the images locally
- the images are pushed to GHCR
- Render pulls those images directly from GHCR

## Prerequisites

1. Docker Desktop is installed and running.
2. Your local repo already contains the actual model files, not Git LFS pointers.
3. You have a GitHub personal access token (classic):
   - local push token: `write:packages`
   - Render pull token: `read:packages`

GitHub's package docs currently state that GitHub Packages uses personal access tokens (classic), and that `read:packages` is required to pull private packages while `write:packages` is required to publish them.

## 1. Build and push the images from your machine

Open PowerShell in the repo root and set your publish token:

```powershell
$env:GHCR_TOKEN = "your_github_pat_classic_with_write_packages"
```

Then run:

```powershell
.\deploy\render-image\publish-ghcr.ps1 -Owner Yuuu-05 -User Yuuu-05
```

Notes:

- If you omit `-Tag`, the script uses the current short git commit hash.
- The script also tags both images as `latest` unless you pass `-SkipLatest`.
- Images are pushed as `linux/amd64`, which is the safe default for Render.

## 2. Add a GHCR credential in Render

In Render:

1. Go to `Workspace Settings`.
2. Open `Registry Credentials`.
3. Add a credential with:
   - Registry host: `ghcr.io`
   - Username: your GitHub username
   - Password: your GitHub PAT classic with `read:packages`

You can name the credential anything you like, such as `ghcr-readonly`.

## 3. Create new Render services from Existing Image

You cannot switch an existing Render service from `runtime: docker` to `runtime: image` in place. Create new services for this path, then cut over traffic after they are healthy.

Recommended names:

- backend: `climb-app-backend-img`
- frontend: `climb-app-frontend-img`

### Backend service

Create a `Private Service` from `Existing Image`.

Suggested values:

- Name: `climb-app-backend-img`
- Region: `Singapore`
- Image URL: `ghcr.io/yuuu-05/climb-app-backend:latest`
- Registry credential: your GHCR credential
- Health check path: `/api/health`

Backend environment variables:

```env
NODE_ENV=production
PORT=10000
MONGO_URI=your_mongodb_atlas_connection_string
JWT_SECRET=use_a_new_random_secret
JWT_EXPIRES_IN=7d
BODY_LIMIT=12mb
TRUST_PROXY=1
VISION_PROVIDER=xiaoxiae
VISION_PYTHON_COMMAND=python
VISION_WARM_ON_START=true
VISION_REQUEST_TIMEOUT_MS=120000
VISION_INFER_WORKERS=1
VISION_CALIBRATION_WORKERS=2
VISION_WARM_INFER_WORKERS=1
VISION_BOOT_CALIBRATION_WORKERS=1
VISION_XIAOXIAE_HOLD_WEIGHTS_URL=https://your-model-host/path/model_final.pth
VISION_XIAOXIAE_ROUTE_WEIGHTS_URL=https://your-model-host/path/triplet_network_final.pt
```

If the download endpoint is private, also set either:

```env
VISION_MODEL_DOWNLOAD_AUTH_HEADER=Authorization: Bearer your_token
```

or:

```env
VISION_MODEL_DOWNLOAD_BEARER_TOKEN=your_token
```

### Frontend service

Create a `Web Service` from `Existing Image`.

Suggested values:

- Name: `climb-app-frontend-img`
- Region: `Singapore`
- Image URL: `ghcr.io/yuuu-05/climb-app-frontend:latest`
- Registry credential: your GHCR credential

Frontend environment variables:

```env
PORT=10000
API_UPSTREAM=climb-app-backend-img:10000
```

The frontend image already serves the built SPA and proxies `/api/*` to the private backend via Nginx.

## 4. Test the new image-backed services

1. Open the frontend public URL.
2. Check:

```text
https://your-frontend-service.onrender.com/api/health
```

3. Confirm:
   - `database.state` is `connected`
   - `vision.ready` is `true`

The backend image now downloads the two large Xiaoxiae weights during container startup when they are missing. Keep the smaller `neutral_hold_classifier.pt` bundled in the repository, and provide either mounted files at the existing model paths or the two `VISION_XIAOXIAE_*_URL` variables above.

## 5. Updating the images later

Build and push a new image from your machine:

```powershell
$env:GHCR_TOKEN = "your_github_pat_classic_with_write_packages"
.\deploy\render-image\publish-ghcr.ps1 -Owner Yuuu-05 -User Yuuu-05
```

Then either:

- click `Manual Deploy` in Render for each image-backed service, or
- use a deploy hook

Example deploy hook trigger:

```powershell
.\deploy\render-image\trigger-render-deploy.ps1 -DeployHookUrl "https://api.render.com/deploy/..."
```

If you want Render to pull a specific non-default image tag, pass `-ImageUrl`.
