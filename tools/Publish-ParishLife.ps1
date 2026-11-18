# Purpose: builds the deployable single-origin package (the API publish output with the built frontend in wwwroot) and its zip.
# Makes NO Azure calls: it prints the deploy command for the operator, who runs it only with the owner's go-ahead.
# Main steps: Invoke-Checked (run a native command, stop on failure), npm ci + build, dotnet publish -p:IncludeFrontend=true,
# package checks (no tests/AppHost/tools/keys), and a tar.exe zip with forward-slash entries for the Linux App Service.

#requires -Version 5.1
<#
.SYNOPSIS
Builds artifacts/api-<commit> (API + frontend) and artifacts/api-<commit>.zip for App Service.
.DESCRIPTION
Run from any folder inside the repository with the .NET SDK from global.json and Node on PATH.
Without -IncludeFrontend:$false the package contains the built frontend; with it, the package is API-only (today's deployment).
#>
[CmdletBinding()]
param(
    [bool]$IncludeFrontend = $true,
    # Defaults to <repository>/artifacts, computed below: Windows PowerShell 5.1 leaves $PSScriptRoot empty inside param() defaults.
    [string]$OutputRoot = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Invoke-Checked([string]$File, [string[]]$Arguments, [string]$WorkingDirectory) {
    Push-Location $WorkingDirectory
    try {
        & $File @Arguments
        if ($LASTEXITCODE -ne 0) { throw "$File $($Arguments -join ' ') failed with exit code $LASTEXITCODE." }
    }
    finally { Pop-Location }
}

$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if (-not $OutputRoot) { $OutputRoot = Join-Path $repo 'artifacts' }
$commit = (& git -C $repo rev-parse --short HEAD).Trim()
$dirty = & git -C $repo status --porcelain
if ($dirty) { Write-Warning 'The working tree has uncommitted changes; the package will not match a commit exactly.' }

$name = if ($IncludeFrontend) { "api-$commit" } else { "api-only-$commit" }
New-Item -ItemType Directory -Force -Path $OutputRoot | Out-Null
$output = Join-Path (Resolve-Path $OutputRoot).Path $name
$zip = "$output.zip"
if (Test-Path $output) { Remove-Item -Recurse -Force -Path $output }
if (Test-Path $zip) { Remove-Item -Force -Path $zip }

if ($IncludeFrontend) {
    $frontend = Join-Path $repo 'frontend'
    Invoke-Checked 'npm' @('ci') $frontend
    Invoke-Checked 'npm' @('run', 'build') $frontend
}

$publish = @('publish', (Join-Path $repo 'ParishLife.Api/ParishLife.Api.csproj'), '-c', 'Release', '-p:UseAppHost=false', '-o', $output)
if ($IncludeFrontend) { $publish += '-p:IncludeFrontend=true' }
Invoke-Checked 'dotnet' $publish $repo

# Only the API and its runtime dependencies (plus the pages when asked) may be deployed.
if (-not (Test-Path (Join-Path $output 'ParishLife.Api.dll'))) { throw 'The publish output has no ParishLife.Api.dll.' }
if ($IncludeFrontend -and -not (Test-Path (Join-Path $output 'wwwroot/index.html'))) { throw 'The package has no wwwroot/index.html.' }
if (-not $IncludeFrontend -and (Test-Path (Join-Path $output 'wwwroot'))) { throw 'An API-only package must not contain wwwroot.' }
$forbidden = Get-ChildItem -Path $output -Recurse -File | Where-Object {
    $_.Name -match '(Tests|AppHost|Maintenance|EndToEnd)\.(dll|pdb)$' -or $_.Name -match '\.(pfx|pem|key)$' -or $_.Name -eq 'keyring.xml'
}
if ($forbidden) { throw "The package contains files that must not be deployed: $($forbidden.Name -join ', ')" }

# tar.exe writes forward-slash entries; Compress-Archive in Windows PowerShell 5.1 writes backslashes, which the Linux deployment rejects.
# The Windows bsdtar by full path: a GNU tar from Git for Windows earlier on PATH reads "C:" as a remote host.
$tar = Join-Path $env:SystemRoot 'System32/tar.exe'
Invoke-Checked $tar @('-a', '-c', '-f', $zip, '*') $output
$files = (Get-ChildItem -Path $output -Recurse -File).Count
Write-Host "Package: $zip ($files files, commit $commit, frontend: $IncludeFrontend)"
Write-Host 'Deploy only with the owner''s go-ahead:'
Write-Host "  az webapp deploy -g rg-parishlife -n app-parishlife --src-path `"$zip`" --type zip --clean true"
