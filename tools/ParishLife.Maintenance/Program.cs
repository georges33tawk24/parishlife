// Purpose: provides explicit private bootstrap, manual identity-review, read-only infrastructure, and operator snapshot
// export/verify/restore (W07; restore only into an empty isolated target, dry-run unless --apply) commands.
// Main members: Option, MaintenanceActor.

using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using ParishLife.Api.Extensions;
using ParishLife.Api.Identity;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Operations;

var arguments = args.ToList();
var local = arguments.Remove("--local");
string? settingsDirectory = null;
var settingsIndex = arguments.IndexOf("--settings");
if (settingsIndex >= 0)
{
    if (settingsIndex + 1 >= arguments.Count)
        throw new ArgumentException("--settings requires the settings directory.");
    settingsDirectory = Path.GetFullPath(arguments[settingsIndex + 1]);
    arguments.RemoveRange(settingsIndex, 2);
}
var apply = arguments.Remove("--apply");
var expectedHash = Option(arguments, "--expect");
if (arguments.Count == 0)
{
    Console.WriteLine("Commands: check-infrastructure | bootstrap-superadmins | verify-identity <account UUID>");
    Console.WriteLine("          snapshot-export <new directory> | snapshot-verify <directory> | snapshot-restore <directory> [--apply]");
    Console.WriteLine("Options: --local uses isolated local documents; --settings <directory> locates API configuration;");
    Console.WriteLine("         --expect <manifest SHA-256> checks the hash recorded in your change record; --apply writes (otherwise a dry run).");
    Console.WriteLine("Azure commands use the signed-in operator's credentials; no resources are provisioned.");
    return;
}

try
{
    if (arguments is ["snapshot-verify", var verifyDirectory])
    {
        // Offline: reads only the snapshot directory; no storage, credentials or settings are needed.
        var verified = await DataSnapshotService.VerifyAsync(verifyDirectory, expectedHash, CancellationToken.None);
        Console.WriteLine($"Snapshot {verified.SnapshotId} verified: {verified.Containers.Sum(c => c.Records)} records in {verified.Containers.Count} containers, {verified.Evidence.Count} evidence files.");
        Console.WriteLine("Manifest SHA-256: " + await DataSnapshotService.ManifestSha256Async(verifyDirectory, CancellationToken.None));
        return;
    }
    var builder = Host.CreateApplicationBuilder(new HostApplicationBuilderSettings
    {
        EnvironmentName = local ? Environments.Development : Environments.Production
    });
    builder.Configuration.SetBasePath(settingsDirectory ?? FindSettingsDirectory()).AddJsonFile("appsettings.json", optional: false)
        .AddJsonFile($"appsettings.{builder.Environment.EnvironmentName}.json", optional: true).AddEnvironmentVariables();
    if (local)
        builder.Configuration["Storage:Provider"] = "Local";
    builder.Services.AddParishLifeBackend(builder.Configuration, builder.Environment, operatorWorkstation: true);
    builder.Services.AddScoped<ICurrentActor, MaintenanceActor>();
    using var host = builder.Build(); // Deliberately never Start/Run: no background jobs or web listener.
    await using var scope = host.Services.CreateAsyncScope();
    switch (arguments[0])
    {
        case "check-infrastructure" when arguments.Count == 1:
            {
                var report = await scope.ServiceProvider.GetRequiredService<InfrastructureReadiness>().ProbeAsync(CancellationToken.None);
                Console.WriteLine($"Provider: {report.Provider}; Ready: {report.Ready}; CheckedAt: {report.CheckedAt:O}");
                foreach (var check in report.Checks)
                    Console.WriteLine($"{check.Key}: {check.Value}");
                if (!report.Ready)
                    Environment.ExitCode = 2;
                break;
            }
        case "bootstrap-superadmins" when arguments.Count == 1:
            {
                var bootstrap = scope.ServiceProvider.GetRequiredService<SuperAdminBootstrapService>();
                Console.WriteLine("This explicit command configures only colinsleiman and georgestawk. It creates no organizations or business records.");
                Console.Write("Type BOOTSTRAP TWO SUPER ADMINS to proceed: ");
                if (Console.ReadLine() != "BOOTSTRAP TWO SUPER ADMINS")
                    throw new InvalidOperationException("Bootstrap was not confirmed.");
                foreach (var username in SuperAdminBootstrapService.Usernames)
                {
                    Console.WriteLine($"Configuring {username}; enter credentials privately on this trusted workstation.");
                    Console.Write("Operator identity-verification reference: ");
                    var evidence = Guard.Text(Console.ReadLine(), "Verification reference", 500);
                    var password = ReadSecret("New or existing password (16–200 characters): ");
                    if (password != ReadSecret("Repeat password: "))
                        throw new InvalidOperationException("Passwords did not match.");
                    var user = await bootstrap.PrepareAsync(username, password, evidence, CancellationToken.None);
                    string? secret = null;
                    if (!user.TwoFactorEnabled)
                    {
                        Console.WriteLine("Create a Base32 TOTP secret in your trusted password manager/authenticator and add that same secret to your authenticator.");
                        secret = ReadSecret("Authenticator secret (private, never displayed or logged): ").Replace(" ", "", StringComparison.Ordinal).ToUpperInvariant();
                    }
                    var code = ReadSecret("Current authenticator code: ");
                    await bootstrap.CompleteAsync(user, secret, code, CancellationToken.None);
                    Console.WriteLine($"Super Admin configured: {username}. Credentials were not printed.");
                }
                break;
            }
        case "verify-identity" when arguments.Count == 2:
            {
                var users = scope.ServiceProvider.GetRequiredService<UserManager<ParishUser>>();
                var user = await users.FindByIdAsync(Guard.Id(Guid.Parse(arguments[1]))) ?? throw new InvalidOperationException("Account not found.");
                if (!user.Active || string.IsNullOrWhiteSpace(user.Email))
                    throw new InvalidOperationException("An active account with an actual email is required.");
                Console.WriteLine($"Recording a manual identity review for account {user.Id}; this grants no administrator or clergy authority.");
                Console.Write("Manual identity-review evidence reference: ");
                var evidence = Guard.Text(Console.ReadLine(), "Verification reference", 500);
                Console.Write("Type the verified account email: ");
                if (Console.ReadLine() != user.Email || !await users.CheckPasswordAsync(user, ReadSecret("Registrant's current password: ")))
                    throw new InvalidOperationException("Contact/credential ownership was not verified.");
                user.IdentityVerified = true;
                user.ContactVerificationReference = evidence;
                Check(await users.UpdateAsync(user));
                Check(await users.UpdateSecurityStampAsync(user));
                Console.WriteLine("Manual identity review recorded; email confirmation is unchanged and earlier sessions/challenges are invalidated.");
                break;
            }
        case "snapshot-export" when arguments.Count == 2:
            {
                Console.WriteLine("Export reads every record container and referenced evidence; the key ring and secrets are never read. Stop writes first.");
                Console.Write("Operator change/approval reference: ");
                var manifest = await scope.ServiceProvider.GetRequiredService<DataSnapshotService>().ExportAsync(arguments[1], Console.ReadLine() ?? "", CancellationToken.None);
                Console.WriteLine($"Snapshot {manifest.SnapshotId}: {manifest.Containers.Sum(c => c.Records)} records in {manifest.Containers.Count} containers, {manifest.Evidence.Count} evidence files.");
                Console.WriteLine("Record this manifest SHA-256 in your change record: " + await DataSnapshotService.ManifestSha256Async(arguments[1], CancellationToken.None));
                Console.WriteLine("Store the directory privately; it holds personal data. A snapshot is not proven restorable until a restore exercise passes.");
                break;
            }
        case "snapshot-restore" when arguments.Count == 2:
            {
                var snapshots = scope.ServiceProvider.GetRequiredService<DataSnapshotService>();
                Console.Write("Operator change/approval reference: ");
                var reference = Console.ReadLine() ?? "";
                var plan = await snapshots.RestoreAsync(arguments[1], expectedHash, reference, apply: false, CancellationToken.None);
                Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(plan, new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web) { WriteIndented = true }));
                if (plan.Status != "DryRunReady")
                {
                    Environment.ExitCode = 2;
                    break;
                }
                if (!apply)
                {
                    Console.WriteLine("Dry run only; nothing was written. Re-run with --apply to restore into this empty target.");
                    break;
                }
                Console.Write($"Type RESTORE {plan.SnapshotId} INTO {plan.TargetDocuments} to proceed: ");
                if (Console.ReadLine() != $"RESTORE {plan.SnapshotId} INTO {plan.TargetDocuments}")
                    throw new InvalidOperationException("Restore was not confirmed.");
                var report = await snapshots.RestoreAsync(arguments[1], expectedHash, reference, apply: true, CancellationToken.None);
                Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(report, new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web) { WriteIndented = true }));
                if (report.Status != "Restored")
                    Environment.ExitCode = 2;
                break;
            }
        default:
            throw new InvalidOperationException("Unknown command or incorrect arguments.");
    }
}
catch (Exception exception)
{
    Console.Error.WriteLine(exception is DomainException domain ? $"{domain.Code}: {domain.Message}"
        : exception is InvalidOperationException invalid ? invalid.Message
        : $"Operation failed ({exception.GetType().Name}); verify the recorded outcome before retrying.");
    Environment.ExitCode = 1;
}

static string FindSettingsDirectory()
{
    foreach (var start in new[] { Directory.GetCurrentDirectory(), AppContext.BaseDirectory })
        for (var directory = new DirectoryInfo(start); directory is not null; directory = directory.Parent)
        {
            var api = Path.Combine(directory.FullName, "ParishLife.Api");
            if (File.Exists(Path.Combine(api, "appsettings.json")))
                return api;
        }
    throw new InvalidOperationException("Supply --settings <directory> containing the API appsettings.json.");
}

static string? Option(List<string> arguments, string name)
{
    var index = arguments.IndexOf(name);
    if (index < 0)
        return null;
    if (index + 1 >= arguments.Count)
        throw new ArgumentException(name + " requires a value.");
    var value = arguments[index + 1];
    arguments.RemoveRange(index, 2);
    return value;
}

static void Check(IdentityResult result)
{
    if (!result.Succeeded)
        throw new InvalidOperationException("Identity operation failed: " + string.Join(", ", result.Errors.Select(error => error.Code)));
}

static string ReadSecret(string prompt)
{
    if (Console.IsInputRedirected)
        throw new InvalidOperationException("A trusted interactive terminal is required for credentials.");
    Console.Write(prompt);
    var value = new System.Text.StringBuilder();
    while (true)
    {
        var key = Console.ReadKey(intercept: true);
        if (key.Key == ConsoleKey.Enter)
        {
            Console.WriteLine();
            return value.ToString();
        }
        if (key.Key == ConsoleKey.Backspace)
        {
            if (value.Length > 0)
                value.Length--;
        }
        else if (!char.IsControl(key.KeyChar) && value.Length < 200)
            value.Append(key.KeyChar);
    }
}

internal sealed class MaintenanceActor : ICurrentActor
{
    public string? ActingAppointmentId => null;
    public string AccountId => throw new InvalidOperationException("Use an explicit operator command; there is no authenticated web user.");
}
