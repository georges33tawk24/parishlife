// Purpose: Registers ordinary email accounts using Identity managers without creating people, appointments, or
// fake verification.
// Main functions: RegisterAsync.

using System.Net.Mail;
using Microsoft.AspNetCore.Identity;
using ParishLife.Api.DTOs.Accounts;
using ParishLife.Api.Identity;
using ParishLife.Api.Models;

namespace ParishLife.Api.Services.Accounts;

public sealed class AccountService(UserManager<ParishUser> users, IUserStore<ParishUser> store)
{
    public async Task RegisterAsync(RegisterAccountDto request, CancellationToken ct)
    {
        var id = Guard.Id(request.OperationId);
        var email = Guard.Text(request.Email, "Email", 254);
        if (!MailAddress.TryCreate(email, out var parsed) || parsed.Address != email)
            throw new DomainException("invalid_email", "A valid email address is required.");
        var name = Guard.Text(request.DisplayName, "Display name");
        if (request.Password is null || request.Password.Length is < 16 or > 200)
            throw new DomainException("invalid_password", "Password must contain 16–200 characters.");
        var prior = await users.FindByIdAsync(id);
        if (prior is not null)
        {
            if (users.NormalizeEmail(email) != prior.NormalizedEmail || !await users.CheckPasswordAsync(prior, request.Password))
                return;
            if (!prior.Active && store is CosmosIdentityStore cosmosStore)
                _ = await cosmosStore.CompleteRegistrationAsync(prior, ct);
            return;
        }

        var user = new ParishUser
        {
            Id = id,
            Email = email,
            UserName = email,
            DisplayName = name,
            LockoutEnabled = true
        };
        var result = await users.CreateAsync(user, request.Password);
        if (!result.Succeeded && result.Errors.Any(e => e.Code is not ("DuplicateEmail" or "DuplicateUserName" or "DuplicateAccount")))
            throw new DomainException("registration_invalid", "The account could not be registered with the supplied details.");
        // Return the same neutral public response for existing and new identifiers.
        // Contact verification is deliberately not fabricated or auto-confirmed.
    }
}
