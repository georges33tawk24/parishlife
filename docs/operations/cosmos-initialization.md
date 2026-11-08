# One-command Cosmos initialization

You do not have to click through database/container creation. Manually choosing/purchasing Azure resources does not require manually entering every application container.

Create/select your Cosmos DB **NoSQL serverless account** first, with the documented region/zone/consistency choices. Then use the checked-in script, signed in as your authorized operator. The script requires Azure CLI and PowerShell 5.1 or 7; Bicep, Cosmos account keys, Blob configuration and a Key Vault key are not required by this initialization command.

From `C:/Users/User/source/repos/ParishLife`:

```powershell
# Offline preview: makes no Azure calls.
.\tools\Initialize-Cosmos.ps1 -ResourceGroup 'YOUR-RESOURCE-GROUP' -AccountName 'your-cosmos-account'

# Explicit application after signing into Azure CLI.
az login
.\tools\Initialize-Cosmos.ps1 -ResourceGroup 'YOUR-RESOURCE-GROUP' -AccountName 'your-cosmos-account' -SubscriptionId 'YOUR-SUBSCRIPTION-UUID' -Apply
```

Use your actual resource names and subscription UUID. `-Apply -WhatIf` reads Azure metadata and displays planned mutations without performing them. Normal `-Apply` does not prompt separately for each container. Operator management-plane authorization is required; the API's Cosmos data role is a separate concern.

The command uses `docs/cosmos/containers.json` as its source of truth. It:

1. Validates the explicit subscription/account, NoSQL/serverless mode and Strong consistency.
2. Checks all existing target containers before any write. Different partition keys/version, enabled TTL, unique keys, additional index extensions or case-only naming conflicts stop the operation for review.
3. Creates `ParishLife` if absent and only the missing containers.
4. Applies the manifest indexing policy to compatible containers whose policy differs; already matching containers remain unchanged.
5. Never deletes/recreates existing containers, changes their partition keys, configures throughput, seeds users/prices or changes ordinary parish data. A partial failure can be retried after its cause is resolved.

The current five containers are shared across parish tenants. Adding a parish inserts its scoped records, not another set of containers. These five cover the implemented foundation; additional modules may introduce further containers with reviewed access/transaction requirements.

The distinction is **explicit automated setup versus ordinary application startup**. The initialization command needs provisioning privileges; the normal API does not automatically provision its infrastructure on every deployment or restart.

Local verification: ten mocked-CLI scenarios passed in both PowerShell 5.1 and PowerShell 7, including missing/partial/complete setup, index alignment, immutable mismatch, wrong consistency, authorization failure, default preview and WhatIf. No Azure resource was read or changed during those checks. Actual execution against your account still needs your resource names, subscription and access.

References: [Azure container creation options](https://learn.microsoft.com/en-us/azure/cosmos-db/how-to-create-container), [serverless CLI example](https://learn.microsoft.com/en-us/azure/cosmos-db/scripts/cli/nosql/serverless), [container CLI reference](https://learn.microsoft.com/en-us/cli/azure/cosmosdb/sql/container?view=azure-cli-latest).
