param(
    [Parameter(Mandatory = $true)]
    [string]$Owner,

    [string]$User = "",

    [string]$Tag = "",

    [switch]$SkipLatest
)

$ErrorActionPreference = "Stop"

if (-not $User) {
    $User = $Owner
}

$normalizedOwner = $Owner.ToLowerInvariant()

if (-not $Tag) {
    $Tag = (git rev-parse --short HEAD).Trim()
    if (-not $Tag) {
        throw "Unable to determine a default image tag from git. Pass -Tag explicitly."
    }
}

$token = $env:GHCR_TOKEN
if (-not $token) {
    throw "Set GHCR_TOKEN to a GitHub personal access token (classic) with write:packages before running this script."
}

try {
    docker info | Out-Null
} catch {
    throw "Docker Desktop is not running. Start Docker Desktop and retry."
}

$frontendImage = "ghcr.io/$normalizedOwner/climb-app-frontend:$Tag"
$backendImage = "ghcr.io/$normalizedOwner/climb-app-backend:$Tag"
$frontendLatest = "ghcr.io/$normalizedOwner/climb-app-frontend:latest"
$backendLatest = "ghcr.io/$normalizedOwner/climb-app-backend:latest"

Write-Host "Logging into ghcr.io as $User..."
$token | docker login ghcr.io -u $User --password-stdin

$frontendTags = @("-t", $frontendImage)
$backendTags = @("-t", $backendImage)

if (-not $SkipLatest) {
    $frontendTags += @("-t", $frontendLatest)
    $backendTags += @("-t", $backendLatest)
}

Write-Host "Building and pushing frontend image $frontendImage ..."
& docker buildx build `
    --platform linux/amd64 `
    --push `
    @frontendTags `
    --build-arg VITE_API_BASE_URL=/api `
    --build-arg VITE_ENABLE_DEV_AUTH_BYPASS=false `
    -f climb-app-frontend/Dockerfile `
    climb-app-frontend
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

Write-Host "Building and pushing backend image $backendImage ..."
& docker buildx build `
    --platform linux/amd64 `
    --push `
    @backendTags `
    -f climb-app-backend/Dockerfile `
    climb-app-backend
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "Published images:"
Write-Host "  Frontend: $frontendImage"
Write-Host "  Backend : $backendImage"
if (-not $SkipLatest) {
    Write-Host "  Frontend latest: $frontendLatest"
    Write-Host "  Backend latest : $backendLatest"
}
Write-Host ""
Write-Host "Next:"
Write-Host "  1. In Render, create image-backed services using these image URLs."
Write-Host "  2. Set frontend API_UPSTREAM to your private backend host:port."
Write-Host "  3. Re-deploy those services manually or via deploy hooks after each new push."
