# Purpose: creates the VAPID key pair for ParishLife push notifications (Web Push, RFC 8292) and stores the private key straight in Key Vault.
# Main steps: make a P-256 key; write the private key as the Key Vault secret (default webpush-private-key) with the Azure CLI, without ever
# printing it; print only the public key, which is not secret and goes into the App Service setting WebPush__PublicKey.
# Run once, by the Azure session with the owner's go-ahead; running it again replaces the key and every device must turn notifications on again.
# Usage: ./tools/New-VapidKeys.ps1 -VaultName keyvault-parishlife [-SecretName webpush-private-key]

param(
    [Parameter(Mandatory = $true)][string]$VaultName,
    [string]$SecretName = 'webpush-private-key'
)

$ErrorActionPreference = 'Stop'

function ConvertTo-Base64Url([byte[]]$Bytes) {
    [Convert]::ToBase64String($Bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

$key = [System.Security.Cryptography.ECDsa]::Create([System.Security.Cryptography.ECCurve+NamedCurves]::nistP256)
try {
    $parameters = $key.ExportParameters($true)
    $public = ConvertTo-Base64Url ([byte[]](@(4) + $parameters.Q.X + $parameters.Q.Y))
    $private = ConvertTo-Base64Url $parameters.D
    # The private key goes to Key Vault through a temporary file the CLI reads, never through the screen or the command line.
    $file = [System.IO.Path]::GetTempFileName()
    try {
        [System.IO.File]::WriteAllText($file, $private)
        az keyvault secret set --vault-name $VaultName --name $SecretName --file $file --output none
        if ($LASTEXITCODE -ne 0) { throw "Storing the private key in Key Vault failed (exit $LASTEXITCODE)." }
    }
    finally {
        Remove-Item -LiteralPath $file -Force -ErrorAction SilentlyContinue
        $private = $null
    }
}
finally {
    $key.Dispose()
}

Write-Output "Private key stored in Key Vault '$VaultName' as secret '$SecretName'."
Write-Output "WebPush__PublicKey = $public"
Write-Output "WebPush__PrivateKey = @Microsoft.KeyVault(SecretUri=https://$VaultName.vault.azure.net/secrets/$SecretName/)"
