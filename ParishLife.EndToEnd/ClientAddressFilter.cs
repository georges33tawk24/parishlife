// Purpose: lets each browser test act as its own client in the test-only host. Every test connects from 127.0.0.1, but the API's rate
// limits are per client address; the X-E2E-Client header (sent only by the Playwright tests) sets the remote address, so each role
// is limited like a separate device instead of all roles sharing one budget. Never part of the deployed API.
// Main function: Configure rewrites Connection.RemoteIpAddress from a valid header before the API pipeline runs.

using System.Net;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;

namespace ParishLife.EndToEnd;

public class ClientAddressFilter : IStartupFilter
{
    public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
    {
        app.Use(async (context, call) =>
        {
            if (IPAddress.TryParse(context.Request.Headers["X-E2E-Client"].ToString(), out var address))
                context.Connection.RemoteIpAddress = address;
            await call();
        });
        next(app);
    };
}
