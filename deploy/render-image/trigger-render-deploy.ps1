param(
    [Parameter(Mandatory = $true)]
    [string]$DeployHookUrl,

    [string]$ImageUrl = ""
)

$ErrorActionPreference = "Stop"

$targetUrl = $DeployHookUrl
if ($ImageUrl) {
    $separator = "?"
    if ($DeployHookUrl.Contains("?")) {
        $separator = "&"
    }
    $targetUrl = "$DeployHookUrl$separator" + "imgURL=" + [System.Uri]::EscapeDataString($ImageUrl)
}

Invoke-WebRequest -Method Post -Uri $targetUrl | Out-Null
Write-Host "Triggered Render deploy hook."
