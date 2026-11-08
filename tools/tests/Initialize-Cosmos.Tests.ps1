# Purpose: Isolated checks for the Cosmos operator script; does not provision production resources.
# Main functions: New-ExistingContainer, Reset-Scenario, global, Assert-True, Write-Calls, Invoke-Apply, Assert-RefusedBeforeWrites.

#requires -Version 5.1
# Isolated CLI-contract checks. This function replaces az; no Azure call occurs.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$scriptPath = Join-Path $PSScriptRoot '../Initialize-Cosmos.ps1'
$manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot '../../docs/cosmos/containers.json') -Raw | ConvertFrom-Json
$subscription = [Guid]'11111111-2222-3333-4444-555555555555'
$global:ParishLifeProvisioningCalls = [System.Collections.Generic.List[object]]::new()
$global:ParishLifeProvisioningScenario = $null
$global:ParishLifeProvisioningManifest = $manifest

function New-ExistingContainer {
    param([object]$Spec)
    return [pscustomobject]@{ name = $Spec.id; resource = [pscustomobject]@{
        id = $Spec.id; partitionKey = $Spec.partitionKey; indexingPolicy = $Spec.indexingPolicy
        uniqueKeyPolicy = [pscustomobject]@{ uniqueKeys = @() }
    } }
}
function Reset-Scenario {
    param([bool]$DatabaseExists, [object[]]$Containers = @())
    $global:ParishLifeProvisioningCalls.Clear()
    $global:ParishLifeProvisioningScenario = [pscustomobject]@{
        DatabaseExists = $DatabaseExists; Containers = $Containers
        Consistency = 'Strong'; Denied = $false
    }
}
function global:az {
    $parts = @($args | ForEach-Object { [string]$_ })
    $global:ParishLifeProvisioningCalls.Add([object]$parts)
    $global:LASTEXITCODE = 0
    if ($global:ParishLifeProvisioningScenario.Denied) { $global:LASTEXITCODE = 1; return 'AuthorizationFailed' }
    if (($parts[0..1] -join ' ') -eq 'cosmosdb show') {
        return (@{
            id = '/subscriptions/11111111-2222-3333-4444-555555555555/resourceGroups/rg-parishlife/providers/Microsoft.DocumentDB/databaseAccounts/cosmos-parishlife'
            kind = 'GlobalDocumentDB'; capabilities = @(@{ name = 'EnableServerless' })
            consistencyPolicy = @{ defaultConsistencyLevel = $global:ParishLifeProvisioningScenario.Consistency }
        } | ConvertTo-Json -Compress -Depth 12)
    }
    $command = $parts[0..3] -join ' '
    if ($command -eq 'cosmosdb sql database list') {
        $dbs = @()
        if ($global:ParishLifeProvisioningScenario.DatabaseExists) { $dbs = @(@{ name = 'ParishLife'; resource = @{ id = 'ParishLife' } }) }
        return (ConvertTo-Json -InputObject $dbs -Compress -Depth 12)
    }
    if ($command -eq 'cosmosdb sql container list') {
        return (ConvertTo-Json -InputObject @($global:ParishLifeProvisioningScenario.Containers) -Compress -Depth 20)
    }
    if ($parts[3] -in @('create', 'update')) {
        if ($parts -contains '--throughput' -or $parts -contains '--max-throughput' -or $parts -contains '--ttl') { throw 'Unexpected throughput/TTL mutation.' }
        $index = [Array]::IndexOf($parts, '--idx')
        if ($index -ge 0) {
            $file = $parts[$index + 1].Substring(1)
            $null = Get-Content -LiteralPath $file -Raw | ConvertFrom-Json
        }
        return '{}'
    }
    throw "Unexpected CLI command in isolated test: $command"
}
function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw $Message }
}
function Write-Calls {
    return ,@($global:ParishLifeProvisioningCalls | Where-Object { $_.Count -gt 3 -and $_[3] -in @('create', 'update', 'delete') })
}
function Invoke-Apply {
    & $scriptPath -ResourceGroup 'rg-parishlife' -AccountName 'cosmos-parishlife' -SubscriptionId $subscription -Apply -Confirm:$false 6>$null | Out-Null
}
function Assert-RefusedBeforeWrites {
    $refused = $false
    try { Invoke-Apply } catch { $refused = $true }
    Assert-True $refused 'Expected preflight refusal.'
    Assert-True ((Write-Calls).Count -eq 0) 'A mutation occurred before all preflight checks passed.'
}

$checks = 0
try {
    Reset-Scenario $false
    & $scriptPath -ResourceGroup 'rg-parishlife' -AccountName 'cosmos-parishlife' 6>$null | Out-Null
    Assert-True ($global:ParishLifeProvisioningCalls.Count -eq 0) 'Default preview contacted Azure.'; $checks++

    Reset-Scenario $false
    $refused = $false
    try { & $scriptPath -ResourceGroup 'rg-parishlife' -AccountName 'cosmos-parishlife' -Apply 6>$null | Out-Null } catch { $refused = $true }
    Assert-True ($refused -and $global:ParishLifeProvisioningCalls.Count -eq 0) 'Apply used an implicit subscription.'; $checks++

    Reset-Scenario $false
    Invoke-Apply
    Assert-True ((Write-Calls).Count -eq 6) 'Missing database plus five containers were not provisioned.'; $checks++

    $all = @($manifest.containers | ForEach-Object { New-ExistingContainer $_ })
    Reset-Scenario $true $all
    Invoke-Apply
    Assert-True ((Write-Calls).Count -eq 0) 'Compatible existing resources were unnecessarily changed.'; $checks++

    Reset-Scenario $true @($all[0], $all[1])
    Invoke-Apply
    Assert-True ((Write-Calls).Count -eq 3) 'Partially created resources were not reused.'; $checks++

    $bad = New-ExistingContainer $manifest.containers[4]
    $bad.resource.partitionKey = [pscustomobject]@{ paths = @('/wrong'); kind = 'Hash'; version = 2 }
    Reset-Scenario $true @($bad)
    Assert-RefusedBeforeWrites; $checks++

    Reset-Scenario $false
    $global:ParishLifeProvisioningScenario.Consistency = 'Session'
    Assert-RefusedBeforeWrites; $checks++

    Reset-Scenario $false
    $global:ParishLifeProvisioningScenario.Denied = $true
    Assert-RefusedBeforeWrites; $checks++

    $different = New-ExistingContainer $manifest.containers[0]
    $different.resource.indexingPolicy = [pscustomobject]@{
        automatic = $true; indexingMode = 'consistent'; includedPaths = @(@{ path = '/*' }); excludedPaths = @(@{ path = '/"_etag"/?' })
    }
    Reset-Scenario $true @($different, $all[1], $all[2], $all[3], $all[4])
    Invoke-Apply
    Assert-True ((Write-Calls).Count -eq 1 -and (Write-Calls)[0][3] -eq 'update') 'Existing default indexes were not aligned with one update.'; $checks++

    Reset-Scenario $false
    & $scriptPath -ResourceGroup 'rg-parishlife' -AccountName 'cosmos-parishlife' -SubscriptionId $subscription -Apply -WhatIf 6>$null | Out-Null
    Assert-True ((Write-Calls).Count -eq 0) 'WhatIf performed a mutation.'; $checks++

    Write-Output "$checks provisioning checks passed; no Azure connection or resource change."
}
finally {
    Remove-Item -LiteralPath 'Function:\az' -Force
    Remove-Variable -Name ParishLifeProvisioningCalls, ParishLifeProvisioningScenario, ParishLifeProvisioningManifest -Scope Global
}
