# Operator data snapshot, verification and restore (W07)

Updated 11 November 2026. Source basis: S31.16 and WF64/FM64 (proposed recommendation, not owner-approved); S32.05 support routing is not part of this slice. Open input **U15** (actual backup coverage, key custody, restore evidence, support channels) still blocks any production recovery-readiness claim.

These are **private operator commands** in `tools/ParishLife.Maintenance`. There is no public API endpoint, and the web host does not register the service. A browser **Data snapshot / Review export** (see [people-search-and-export.md](people-search-and-export.md)) is a field-limited review file. It is not a restorable backup and cannot be uploaded to replace records.

## Commands

```powershell
# 1. Export (read-only on the source). Stop API writes first (maintenance window).
dotnet run --project tools/ParishLife.Maintenance -- snapshot-export D:\private\snap-2026-11-11
# 2. Verify offline (needs no settings, storage or credentials)
dotnet run --project tools/ParishLife.Maintenance -- snapshot-verify D:\private\snap-2026-11-11 --expect <manifest SHA-256>
# 3. Restore exercise into an EMPTY isolated target: dry run first, then --apply
dotnet run --project tools/ParishLife.Maintenance -- --settings <isolated target settings> snapshot-restore D:\private\snap-2026-11-11 --expect <hash>
dotnet run --project tools/ParishLife.Maintenance -- --settings <isolated target settings> snapshot-restore D:\private\snap-2026-11-11 --expect <hash> --apply
```

Each command asks for an operator change/approval reference. That reference is stored in the manifest and in the restore audit row. It must not contain credentials. `--local` and `Storage__LocalPath` select an isolated Development directory.

## What a snapshot contains

- `records/<Container>.jsonl` holds every item of every **existing** container in the configured database, one line per item, enumerated live rather than from a fixed list. Items are copied exactly as stored, minus the storage system properties (`_rid`, `_self`, `_etag`, `_attachments`, `_ts`). Audit rows, receipts and history travel with their records.
- `evidence/NNNNNN.bin` holds each write-once evidence object that a record references (`data.storagePath` plus `data.contentType`). The export fails if a referenced object is missing.
- `manifest.json` records the format/version (`ParishLife.OperatorSnapshot` v1), snapshot ID, UTC time, operator reference, and the non-secret source identities (provider plus endpoint/database or local path; Blob service/container). It also lists the exclusions and, per container, the file, record count, partition count and SHA-256. Each evidence entry has its storage path, content type, size and SHA-256.
- `manifest.sha256` holds the manifest hash. The export prints it; **record it in the change record** and pass it with `--expect`. Without an out-of-band hash, a tamperer could rewrite the manifest and its hash file together.

**Never included:** the Data Protection key ring (it is never read; in Azure it lives in the separate `data-protection` container), Key Vault keys, credentials, connection strings and settings, and unreferenced staged uploads. Protected fields (MFA authenticator keys, recovery codes, pastoral/concern/incident content, person facts) stay `dp1:` ciphertext. A restored environment can read them only with the **matching** key ring and Key Vault key, supplied separately by their custodian. Account records do carry password hashes, and evidence files and records are personal data, so store snapshots in a private, access-controlled, encrypted location.

**Consistency:** the export reads everything twice and writes the manifest only if no item was added, removed or changed between the two passes. Otherwise it fails with `snapshot_source_changed`, and the directory has no manifest, so it is never valid. The two-pass check is not a point-in-time guarantee: an item created and deleted between the passes cannot be detected. Writes must therefore still be stopped. An existing non-empty output directory is refused.

## Verification and restore rules

- Verify checks:
  - the manifest hash, plus the recorded hash when given;
  - the format/version;
  - that the directory holds **exactly** the listed files (a stray `keyring.xml` or log fails);
  - per-file hashes, counts, partition counts and duplicate identities;
  - that no record line carries storage properties, and that evidence sizes and hashes match.
- Restore always re-verifies first. It **refuses**, writing nothing (`Status: Refused`, exit code 2), when:
  - the target record store or evidence store is the snapshot's source;
  - any target container holds any item;
  - any snapshot evidence path already exists in the target;
  - or, for Cosmos, a snapshot container is missing. Create the containers in the isolated database with the reviewed [initialization procedure](cosmos-initialization.md); this tool never provisions anything.
- A dry run reports the target identities, records, partitions, planned batches, evidence count/bytes and missing containers.
- `--apply` repeats the checks and requires the typed confirmation `RESTORE <snapshotId> INTO <target>`. It then:
  1. writes create-only, per-partition atomic batches of at most 100 items and about 1.5 MB, so an item that appears concurrently is a `write_conflict`, never an overwrite;
  2. writes evidence write-once;
  3. reads every record and evidence object back for exact equality;
  4. appends an audit row (`operations.snapshot_restore`, snapshot ID and operator reference) to Catalog partition `platform:operations` in the **target**.
- The printed JSON report is the restore-exercise evidence (FM64.restoreEvidence).
- A failed or interrupted apply leaves a partially filled isolated target. Discard it and restore into a new empty target, because a non-empty target is always refused.

## Unresolved inputs (no defaults invented)

Retention period, schedule/frequency, RPO, RTO, the approved backup owner/custodian, where snapshots are stored, key-ring custody/escrow and the restore-exercise cadence are **U15 inputs**. The code has no settings or defaults for them. Record the approved values in the operational runbook when the owners supply them. Azure-native Cosmos/Blob backup policy is unchanged and not inspected here.

## Azure-native backups (owner checks; added 22 November 2026)

The legal pages state Cosmos continuous backup of 7 days and Blob soft delete of 30 days (`docs/operations/legal-pages.md`). Neither is in the code, and the hardening run could not check Azure. Steps, all in the Azure portal:
1. **Cosmos DB** `cosmos-parishlife` → **Backup & Restore**. Expect "Continuous (7 days)". That is point-in-time restore to any second in the last 7 days. Azure keeps these backups apart from the database. If the account shows "Periodic", decide with the pricing page whether to switch: the switch to continuous cannot be undone.
2. **Storage** `storageparishlife` → **Data protection**: blob soft delete 30 days and container soft delete 30 days on. Versioning is optional: it costs storage for every overwrite, but evidence files are write-once.
3. **Key Vault** `keyvault-parishlife`: soft delete and purge protection on (recorded on 11 November). Never delete the `parishlife-data-protection` key or its old versions: without them, the protected fields in every backup are unreadable.
4. **Restore test into a separate environment** (the first real one): Cosmos → **Point In Time Restore** → a time 1 hour ago → target account `cosmos-parishlife-restoretest` (a new account; the restore never overwrites the source).
   - When it is ready, add your current IP to its firewall.
   - Run `check-infrastructure` and `snapshot-export` with settings pointing at the restored account. Compare the per-container record counts with a `snapshot-export` of production taken at the same restore time.
   - Write the duration and the counts here, then delete the restored account. It costs serverless storage for as long as it exists.

**Recommended pilot policy** (an owner decision under U15; nothing here is approved yet):
- Cosmos continuous 7 days.
- Blob and container soft delete 30 days.
- An operator snapshot once a month and before every risky change (index change, large import), kept for 3 months.
- One restore drill per quarter, alternating between a local drill and the Azure point-in-time restore above.
- RPO: seconds, with continuous backup. RTO: about an hour, given the drill durations below plus redeploying the app with new settings.

### Where snapshots are kept

Undecided (U15). Snapshots hold personal data and password hashes. Recommended: an encrypted disk the custodian controls (BitLocker or FileVault), outside any synced folder, plus the manifest SHA-256 in the change record. Never commit, email or upload a snapshot. The key ring and Key Vault key are custodied separately and never travel with a snapshot.

## Local restore drill (22 November 2026, local only)

This is not a production restore. Source: a copy of the test-only end-to-end host's fixture store (`ParishLife.EndToEnd`: fixture accounts for every role in temporary local storage). Target: a new, empty local directory. Tool: `tools/ParishLife.Maintenance` in `--local` mode, Release build.
1. `snapshot-export`: 148 records in 5 containers (Accounts 61, Billing 8, Catalog 3, LoginAliases 16, TenantControl 60), 0 evidence files. Under 1 s.
2. `snapshot-verify --expect <manifest SHA-256>`: verified. Under 1 s.
3. `snapshot-restore` dry run: `DryRunReady`, 148 records, 29 batches. About 1 s.
4. `snapshot-restore --apply` with the typed confirmation: `Restored`, 148 of 148 records read back equal. 0.44 s.
5. **Independent check:** a fresh `snapshot-export` of the restored target, compared with the original manifest.
   - Accounts, Billing, LoginAliases and TenantControl have identical counts, partitions and SHA-256.
   - Catalog has the original 3 records plus exactly one more: the restore's own `operations.snapshot_restore` audit row in `platform:operations`, as designed.

Found and fixed during the drill: every `--local` command of the maintenance tool stopped with an `AggregateException`, because Development validates all web registrations when the host is built (commit `2c4fa7f`). Not exercised: evidence files (the fixture uploads none; `ParishLife.IntegrationTests/DataSnapshotTests.cs` covers them), and Cosmos or Blob as source or target.

## Not delivered

- No live Cosmos/Blob run, so local tests do not prove Cosmos cross-partition paging, RBAC or throughput.
- No production restore, and no in-place recovery of a live environment.
- No scheduled or automatic snapshots, no in-app request/approval record (S31.16 assigns backups to operators), no snapshot encryption by the tool, no streaming for very large datasets (records are held in memory), and no S32.05 help/support routing.
