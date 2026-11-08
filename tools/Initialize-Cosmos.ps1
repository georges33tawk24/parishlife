# Purpose: Explicit operator-only Cosmos manifest provisioning/preview; never invoked by API/AppHost startup.
# Main functions: Get-Field, Get-ResourceName, Get-PolicySignature, Assert-CompatibleContainer, Invoke-AzureJson.

#requires -Version 5.1
<#
.SYNOPSIS
Previews or explicitly applies the ParishLife Cosmos database/container contract.
.DESCRIPTION
Uses Azure CLI management operations and the checked-in manifest. Without -Apply,
there are NO Azure calls. With -Apply, preflights all existing containers before
creating missing resources or aligning indexing policies. No items, prices,
accounts, partition keys, TTL settings or existing containers are deleted.
#>
[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'Medium')]
param(
    [Parameter(Mandatory = $true)][ValidatePattern('\A[-\w.()]+\z')][string]$ResourceGroup,
    [Parameter(Mandatory = $true)][ValidatePattern('\A[a-z0-9][a-z0-9-]{1,42}[a-z0-9]\z')][string]$AccountName,
    [Guid]$SubscriptionId = [Guid]::Empty,
    [string]$ManifestPath = (Join-Path $PSScriptRoot '../docs/cosmos/containers.json'),
    [switch]$Apply
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    $PSNativeCommandUseErrorActionPreference = $false
}

function Get-Field {
    param([AllowNull()][object]$Value, [string]$Name)
    if ($null -eq $Value) { return $null }
    $property = $Value.PSObject.Properties[$Name]
    if ($null -ne $property) { return $property.Value }
    return $null
}

function Get-ResourceName {
    param([object]$Value)
    $resource = Get-Field $Value 'resource'
    $id = Get-Field $resource 'id'
    if ($null -ne $id) { return [string]$id }
    return [string](Get-Field $Value 'name')
}

function Get-PolicySignature {
    param([object]$Policy)
    $excluded = @(@(Get-Field $Policy 'excludedPaths') | ForEach-Object { Get-Field $_ 'path' } | Sort-Object -CaseSensitive)
    # Azure can return a redundant system-ETag exclusion beside /*.
    if ($excluded -contains '/*') { $excluded = @($excluded | Where-Object { $_ -cne '/"_etag"/?' }) }
    return ([ordered]@{
        automatic = Get-Field $Policy 'automatic'
        indexingMode = Get-Field $Policy 'indexingMode'
        includedPaths = @(@(Get-Field $Policy 'includedPaths') | ForEach-Object { Get-Field $_ 'path' } | Sort-Object -CaseSensitive)
        excludedPaths = $excluded
    } | ConvertTo-Json -Depth 12 -Compress)
}

function Assert-CompatibleContainer {
    param([object]$Existing, [object]$Expected)
    $actual = Get-Field $Existing 'resource'
    $key = Get-Field $actual 'partitionKey'
    $paths = @(Get-Field $key 'paths')
    if ($paths.Count -ne 1 -or $paths[0] -cne $Expected.partitionKey.paths[0] -or
        (Get-Field $key 'kind') -cne $Expected.partitionKey.kind -or
        (Get-Field $key 'version') -ne $Expected.partitionKey.version) {
        throw "Container '$($Expected.id)' has a different partition-key contract. No resources were changed. Review migration; this tool never deletes/recreates it."
    }
    if ($null -ne (Get-Field $actual 'defaultTtl')) {
        throw "Container '$($Expected.id)' has TTL enabled. No resources were changed. Review its existing data lifecycle first."
    }
    $unique = Get-Field (Get-Field $actual 'uniqueKeyPolicy') 'uniqueKeys'
    if (@($unique | Where-Object { $null -ne $_ }).Count -gt 0) {
        throw "Container '$($Expected.id)' has an existing unique-key policy. No resources were changed. Review the immutable policy first."
    }
    $policy = Get-Field $actual 'indexingPolicy'
    foreach ($extension in @('compositeIndexes', 'spatialIndexes', 'vectorIndexes')) {
        if (@((Get-Field $policy $extension) | Where-Object { $null -ne $_ }).Count -gt 0) {
            throw "Container '$($Expected.id)' has additional index extensions. No resources were changed. Review them before aligning the policy."
        }
    }
}

if (-not (Test-Path -LiteralPath $ManifestPath -PathType Leaf)) { throw 'Container manifest was not found.' }
$manifest = Get-Content -LiteralPath $ManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ($manifest.contractVersion -ne 1 -or $manifest.capacity -cne 'Serverless' -or
    $manifest.defaultConsistencyLevel -cne 'Strong' -or $manifest.database -cnotmatch '\A[A-Za-z][A-Za-z0-9_-]{0,254}\z') {
    throw 'Unsupported container manifest contract.'
}
$specifications = @($manifest.containers)
if ($specifications.Count -eq 0 -or @($specifications.id | Sort-Object -Unique).Count -ne $specifications.Count) {
    throw 'Manifest container names must be nonempty and distinct.'
}
foreach ($spec in $specifications) {
    if ($spec.id -cnotmatch '\A[A-Za-z][A-Za-z0-9_-]{0,254}\z' -or @($spec.partitionKey.paths).Count -ne 1 -or
        $spec.partitionKey.paths[0] -cne '/partitionKey' -or $spec.partitionKey.kind -cne 'Hash' -or $spec.partitionKey.version -ne 2) {
        throw 'Unsupported container name/partition contract in the manifest.'
    }
}

if (-not $Apply) {
    Write-Host 'Preview only: no Azure calls or changes.'
    Write-Host "Target: resource group '$ResourceGroup', account '$AccountName', database '$($manifest.database)'."
    Write-Host 'An explicit SubscriptionId is required when applying.'
    foreach ($spec in $specifications) { Write-Host "  $($spec.id): create if absent; otherwise validate partition/TTL/unique-key contract and align the manifest indexing policy." }
    Write-Host 'Run again with -SubscriptionId <UUID> -Apply, or add -WhatIf for an Azure-read-only preflight.'
    return
}
if ($SubscriptionId -eq [Guid]::Empty) { throw 'Apply requires an explicit nonempty SubscriptionId; the current Azure CLI default is not used.' }
$azureCommand = Get-Command az -ErrorAction Stop

function Invoke-AzureJson {
    param([string[]]$Arguments)
    $allArguments = $Arguments + @('--subscription', $SubscriptionId.ToString(), '--only-show-errors', '--output', 'json')
    $output = @(& $azureCommand @allArguments 2>&1)
    $code = $LASTEXITCODE
    if ($code -ne 0) { throw "Azure CLI failed (exit $code). No failure is treated as a missing resource. $($output -join [Environment]::NewLine)" }
    if ($output.Count -eq 0) { return $null }
    return (($output -join [Environment]::NewLine) | ConvertFrom-Json)
}

$account = Invoke-AzureJson @('cosmosdb', 'show', '--resource-group', $ResourceGroup, '--name', $AccountName)
$accountId = [string](Get-Field $account 'id')
if (-not $accountId.StartsWith("/subscriptions/$($SubscriptionId.ToString())/", [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Returned account does not belong to the explicitly selected subscription.'
}
$capabilities = @(@(Get-Field $account 'capabilities') | ForEach-Object { Get-Field $_ 'name' })
if ((Get-Field $account 'kind') -cne 'GlobalDocumentDB' -or $capabilities -notcontains 'EnableServerless' -or
    @($capabilities | Where-Object { $_ -in @('EnableMongo', 'EnableCassandra', 'EnableGremlin', 'EnableTable') }).Count -gt 0) {
    throw 'This contract requires an existing Azure Cosmos DB for NoSQL serverless account.'
}
if ((Get-Field (Get-Field $account 'consistencyPolicy') 'defaultConsistencyLevel') -cne 'Strong') {
    throw 'Select Strong default consistency on the account before applying this container contract. This tool does not change account settings.'
}

$databases = @(Invoke-AzureJson @('cosmosdb', 'sql', 'database', 'list', '--resource-group', $ResourceGroup, '--account-name', $AccountName))
$databaseExists = $false
foreach ($database in $databases) {
    $name = Get-ResourceName $database
    if ($name -ieq $manifest.database) {
        if ($name -cne $manifest.database) { throw 'Database name differs only by case. Review it before creating resources.' }
        $databaseExists = $true
    }
}
$existing = [System.Collections.Generic.Dictionary[string, object]]::new([StringComparer]::Ordinal)
if ($databaseExists) {
    foreach ($container in @(Invoke-AzureJson @('cosmosdb', 'sql', 'container', 'list', '--resource-group', $ResourceGroup, '--account-name', $AccountName, '--database-name', $manifest.database))) {
        $existing.Add((Get-ResourceName $container), $container)
    }
}

# Complete every compatibility check before the first write.
foreach ($spec in $specifications) {
    foreach ($name in @($existing.Keys)) {
        if ($name -ieq $spec.id -and $name -cne $spec.id) { throw "Container '$name' differs only by case. Review it first." }
    }
    if ($existing.ContainsKey($spec.id)) { Assert-CompatibleContainer $existing[$spec.id] $spec }
}

if (-not $databaseExists -and $PSCmdlet.ShouldProcess("$AccountName/$($manifest.database)", 'Create missing NoSQL database without provisioned throughput')) {
    $null = Invoke-AzureJson @('cosmosdb', 'sql', 'database', 'create', '--resource-group', $ResourceGroup, '--account-name', $AccountName, '--name', $manifest.database)
}
foreach ($spec in $specifications) {
    $action = if ($existing.ContainsKey($spec.id)) { 'update' } else { 'create' }
    if ($action -eq 'update') {
        $policy = Get-Field (Get-Field $existing[$spec.id] 'resource') 'indexingPolicy'
        if ((Get-PolicySignature $policy) -ceq (Get-PolicySignature $spec.indexingPolicy)) {
            Write-Host "$($spec.id): already matches; kept."
            continue
        }
    }
    if (-not $PSCmdlet.ShouldProcess("$AccountName/$($manifest.database)/$($spec.id)", "$action container/index policy from the committed manifest")) { continue }
    $policyFile = [System.IO.Path]::GetTempFileName()
    try {
        [System.IO.File]::WriteAllText($policyFile, ($spec.indexingPolicy | ConvertTo-Json -Depth 20), [System.Text.UTF8Encoding]::new($false))
        $arguments = @('cosmosdb', 'sql', 'container', $action, '--resource-group', $ResourceGroup, '--account-name', $AccountName,
            '--database-name', $manifest.database, '--name', $spec.id, '--idx', ('@' + $policyFile))
        if ($action -eq 'create') { $arguments += @('--partition-key-path', $spec.partitionKey.paths[0], '--partition-key-version', '2') }
        # No --throughput/--max-throughput for serverless; no TTL or delete operations.
        $null = Invoke-AzureJson $arguments
        Write-Host "$($spec.id): $action submitted successfully."
    }
    finally { Remove-Item -LiteralPath $policyFile -Force }
}
Write-Host 'Container setup/preflight finished. Existing item data and application accounts were not seeded or deleted.'
