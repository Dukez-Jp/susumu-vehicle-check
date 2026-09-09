using Microsoft.AspNetCore.Identity;
using Susumu.Domain;
using Susumu.Domain.Entities;

namespace Susumu.Infrastructure.Security;

public interface IPasswordHashing
{
    string Hash(string password);

    /// <summary>Returns false for wrong passwords and for stored values that are not valid hashes.</summary>
    bool Verify(string storedHash, string password);

    /// <summary>Rejects passwords that are too short to be worth storing. Throws <see cref="AppException"/>.</summary>
    void EnsureAcceptable(string? password);
}

public sealed class PasswordHashing : IPasswordHashing
{
    public const int MinimumLength = 10;

    private readonly PasswordHasher<AppUser> _hasher = new();
    private static readonly AppUser HashContext = new();

    public string Hash(string password) => _hasher.HashPassword(HashContext, password);

    public bool Verify(string storedHash, string password)
    {
        if (string.IsNullOrEmpty(storedHash) || string.IsNullOrEmpty(password))
        {
            return false;
        }

        try
        {
            var result = _hasher.VerifyHashedPassword(HashContext, storedHash, password);
            return result is PasswordVerificationResult.Success or PasswordVerificationResult.SuccessRehashNeeded;
        }
        catch (FormatException)
        {
            return false;
        }
    }

    public void EnsureAcceptable(string? password)
    {
        if (string.IsNullOrWhiteSpace(password) || password.Length < MinimumLength)
        {
            throw AppException.Validation(
                $"Password must be at least {MinimumLength} characters.",
                new Dictionary<string, string[]> { ["password"] = [$"Minimum length is {MinimumLength}."] });
        }

        if (password.Length > 256)
        {
            throw AppException.Validation("Password must be at most 256 characters.");
        }
    }
}
