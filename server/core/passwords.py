"""
Password verification compatible with the .NET `AppPasswordHasher`.

Format: ``v1:{base64(salt)}:{base64(hash)}`` where the hash is
PBKDF2-HMAC-SHA256 with 100,000 iterations.
"""
import base64
import hashlib
import hmac

PREFIX = "v1:"
ITERATIONS = 100_000
# Seeded users created without a password hash accept this legacy demo password.
DEMO_PASSWORD = "Pass@123"


def verify(password: str, stored_hash: str | None) -> bool:
    if not stored_hash or not stored_hash.startswith(PREFIX):
        return False

    payload = stored_hash[len(PREFIX):]
    parts = payload.split(":", 1)
    if len(parts) != 2:
        return False

    try:
        salt = base64.b64decode(parts[0])
        expected = base64.b64decode(parts[1])
    except (ValueError, base64.binascii.Error):
        return False

    actual = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, ITERATIONS, dklen=len(expected)
    )
    return hmac.compare_digest(expected, actual)
