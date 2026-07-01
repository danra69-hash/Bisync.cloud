using System.Security.Cryptography;
using System.Text;

namespace Bisync.Api.Services;

public static class AppPasswordHasher
{
    const string Prefix = "v1:";
    const int Iterations = 100_000;
    const int SaltBytes = 16;
    const int HashBytes = 32;

    public static string Hash(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(SaltBytes);
        var hash = Rfc2898DeriveBytes.Pbkdf2(
            Encoding.UTF8.GetBytes(password),
            salt,
            Iterations,
            HashAlgorithmName.SHA256,
            HashBytes);
        return $"{Prefix}{Convert.ToBase64String(salt)}:{Convert.ToBase64String(hash)}";
    }

    public static bool Verify(string password, string? storedHash)
    {
        if (string.IsNullOrWhiteSpace(storedHash) || !storedHash.StartsWith(Prefix, StringComparison.Ordinal))
            return false;

        var payload = storedHash[Prefix.Length..];
        var parts = payload.Split(':', 2);
        if (parts.Length != 2) return false;

        byte[] salt;
        byte[] expected;
        try
        {
            salt = Convert.FromBase64String(parts[0]);
            expected = Convert.FromBase64String(parts[1]);
        }
        catch
        {
            return false;
        }

        var actual = Rfc2898DeriveBytes.Pbkdf2(
            Encoding.UTF8.GetBytes(password),
            salt,
            Iterations,
            HashAlgorithmName.SHA256,
            expected.Length);

        return CryptographicOperations.FixedTimeEquals(expected, actual);
    }
}
