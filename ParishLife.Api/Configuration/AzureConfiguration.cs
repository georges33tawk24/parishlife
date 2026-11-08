// Purpose: validates Azure endpoint configuration before clients are used; never reads or logs credentials.
// Main functions: IsHttps, IsBlobUri, IsVersionlessKeyUri, IsContainerName.

namespace ParishLife.Api.Configuration;

internal static class AzureConfiguration
{
    internal static bool IsHttps(string? value) => Uri.TryCreate(value, UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps && string.IsNullOrEmpty(uri.UserInfo) && string.IsNullOrEmpty(uri.Query) && string.IsNullOrEmpty(uri.Fragment);
    internal static bool IsBlobUri(string? value) => IsHttps(value) && new Uri(value!).AbsolutePath.Split('/', StringSplitOptions.RemoveEmptyEntries).Length >= 2;
    internal static bool IsVersionlessKeyUri(string? value)
    {
        if (!IsHttps(value))
            return false;
        var parts = new Uri(value!).AbsolutePath.Split('/', StringSplitOptions.RemoveEmptyEntries);
        return parts.Length == 2 && parts[0] == "keys" && parts[1].Length > 0;
    }

    internal static bool IsContainerName(string value) => System.Text.RegularExpressions.Regex.IsMatch(value, @"\A[a-z0-9](?:[a-z0-9]|-(?!-)){1,61}[a-z0-9]\z");
}
