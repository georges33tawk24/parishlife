# Live Cosmos tests (owner decision Q26, 23 November 2026)

Local tests use files on disk, so they cannot prove how real Cosmos DB behaves. The live tests in `ParishLife.IntegrationTests/Live` run the production storage code (`RecordTransactions` on `CosmosDocumentDatabase`) against the separate, empty test database **`ParishLifeTest`**.

## What they check
- A commit can be read back, and an exact retry replays its receipt instead of writing twice.
- A stale version is refused, and a batch that fails part-way keeps nothing.
- A filtered page uses the deployed index policy and stays inside its own partition.
- The guard: only `ParishLifeTest` is accepted. `ParishLife` (the real database) or any other name stops the test before a connection is made. This check runs in every normal test run.

## Safety
- They are **skipped** unless `PARISHLIFE_LIVE_COSMOS_DATABASE` is set, so ordinary test runs never touch the network.
- They sign in with **your own developer account** (`az login` or Visual Studio). The hosted managed identity is excluded, and it cannot reach `ParishLifeTest` anyway.
- Each test writes only into its own random partition (`live-test-…`). The rows stay in the test database, which never holds real data.

## How to run them
Two things must be true first, and both need your go-ahead in the Azure session:
1. The Cosmos firewall allows your computer's IP. It is closed to all IP addresses today; close it again afterwards.
2. You are signed in with `az login` as an account with data access to the Cosmos account.

Then, from the repository folder in PowerShell:

```powershell
$env:PARISHLIFE_LIVE_COSMOS_DATABASE = 'ParishLifeTest'
```

```powershell
dotnet test ParishLife.IntegrationTests --filter "FullyQualifiedName~LiveCosmos"
```

To use another Cosmos account, also set `PARISHLIFE_LIVE_COSMOS_ENDPOINT`. Remove the variable afterwards (`Remove-Item Env:PARISHLIFE_LIVE_COSMOS_DATABASE`).

## Not covered
Blob Storage, Key Vault and the managed identity. These tests are not a deploy check either.
