# DTOs and models: MiniDevOps convention

The owner's reference files were inspected: MiniDevOps.Api's `DTOs/Auth/RegisterDto.cs`, `DTOs/Tasks/CreateTaskItemDto.cs`, `DTOs/Tasks/TaskItemDto.cs`, and `Models/TaskItem.cs`.

```text
ParishLife.Api/
  DTOs/Accounts/LoginDto.cs
  DTOs/Organizations/ProposeBishopAppointmentDto.cs
  DTOs/Billing/InvoiceDto.cs
  Models/Parish.cs
  Models/BishopAppointment.cs
  Models/Invoice.cs
  Models/Enums/ParishStatus.cs
```

Use one ordinary public class per file, explicit get/set properties, safe string/collection defaults, and object initializers. Input DTOs use Data Annotations, including nonempty UUID validation. New consequential decision inputs use required nullable booleans so omission cannot silently become rejection. Services/model rules still enforce cross-field rules, current authorization, exact money, and conditional writes.

DTOs define accepted inputs and explicit authorized outputs. Adding a persistence property must not silently expose it. Current billing, organization, account, and person endpoints project response DTOs. Sensitive Identity documents never become public account DTOs.

Cosmos requires document IDs/partition references instead of relational navigation properties, explicit transaction boundaries, and UTC instants. Identity retains its supported base class. These preserve the requested writing style while honoring the selected infrastructure.

`Models/OperationContractNames.cs` preserves previous request identifiers across DTO renaming so stored idempotency fingerprints remain valid. Existing JSON field names/order are retained. Where prior workflows depended on an unchanged snapshot, changed models use explicit copy initializers. Cursor scope comparisons use actual area/owner values rather than class reference equality.

HTTP tests assert their configured temporary storage directory. Development documents and the key ring resolve final host settings when services are constructed. Tests must not write to the backend's default development directory.
