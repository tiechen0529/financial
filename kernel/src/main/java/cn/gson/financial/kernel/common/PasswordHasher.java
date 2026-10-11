package cn.gson.financial.kernel.common;

import org.apache.commons.codec.digest.DigestUtils;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Locale;

/**
 * Password hashing with transparent migration from the legacy SHA-256 format.
 */
public final class PasswordHasher {

    private static final String SCHEME = "pbkdf2-sha256";
    private static final int ITERATIONS = 210_000;
    private static final int MIN_ITERATIONS = 10_000;
    private static final int MAX_ITERATIONS = 1_000_000;
    private static final int SALT_BYTES = 16;
    private static final int HASH_BITS = 256;
    private static final SecureRandom RANDOM = new SecureRandom();

    private PasswordHasher() {
    }

    public static String hash(String password) {
        if (password == null) {
            throw new IllegalArgumentException("Password must not be null");
        }

        byte[] salt = new byte[SALT_BYTES];
        RANDOM.nextBytes(salt);
        byte[] derived = derive(password, salt, ITERATIONS);
        return SCHEME + "$" + ITERATIONS + "$"
                + Base64.getEncoder().encodeToString(salt) + "$"
                + Base64.getEncoder().encodeToString(derived);
    }

    /**
     * Verifies both current PBKDF2 hashes and the legacy unsalted SHA-256 hashes.
     */
    public static boolean matches(String password, String encoded) {
        if (password == null || encoded == null) {
            return false;
        }

        String[] parts = encoded.split("\\$", -1);
        if (parts.length == 4 && SCHEME.equals(parts[0])) {
            try {
                int iterations = Integer.parseInt(parts[1]);
                if (iterations < MIN_ITERATIONS || iterations > MAX_ITERATIONS) {
                    return false;
                }

                byte[] salt = Base64.getDecoder().decode(parts[2]);
                byte[] expected = Base64.getDecoder().decode(parts[3]);
                if (salt.length < SALT_BYTES || expected.length != HASH_BITS / 8) {
                    return false;
                }
                return MessageDigest.isEqual(expected, derive(password, salt, iterations));
            } catch (IllegalArgumentException e) {
                return false;
            }
        }

        if (!encoded.matches("(?i)[0-9a-f]{64}")) {
            return false;
        }
        byte[] expected = encoded.toLowerCase(Locale.ROOT).getBytes(StandardCharsets.US_ASCII);
        byte[] actual = DigestUtils.sha256Hex(password).getBytes(StandardCharsets.US_ASCII);
        return MessageDigest.isEqual(expected, actual);
    }

    /** Returns whether a successful login should replace this hash with the current format. */
    public static boolean needsUpgrade(String encoded) {
        if (encoded == null) {
            return true;
        }
        String[] parts = encoded.split("\\$", -1);
        if (parts.length != 4 || !SCHEME.equals(parts[0])) {
            return true;
        }
        try {
            return Integer.parseInt(parts[1]) < ITERATIONS;
        } catch (NumberFormatException e) {
            return true;
        }
    }

    private static byte[] derive(String password, byte[] salt, int iterations) {
        PBEKeySpec spec = new PBEKeySpec(password.toCharArray(), salt, iterations, HASH_BITS);
        try {
            return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
                    .generateSecret(spec)
                    .getEncoded();
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("PBKDF2 password hashing is unavailable", e);
        } finally {
            spec.clearPassword();
        }
    }
}
