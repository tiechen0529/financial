package cn.gson.financial.common;

import cn.gson.financial.kernel.common.PasswordHasher;
import org.apache.commons.codec.digest.DigestUtils;
import org.junit.Test;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotEquals;
import static org.junit.Assert.assertTrue;

public class PasswordHasherTest {

    @Test
    public void hashesWithRandomSaltAndVerifiesPassword() {
        String first = PasswordHasher.hash("correct horse battery staple");
        String second = PasswordHasher.hash("correct horse battery staple");

        assertNotEquals(first, second);
        assertTrue(PasswordHasher.matches("correct horse battery staple", first));
        assertFalse(PasswordHasher.matches("wrong password", first));
        assertFalse(PasswordHasher.needsUpgrade(first));
    }

    @Test
    public void acceptsLegacySha256AndRequestsUpgrade() {
        String legacyHash = DigestUtils.sha256Hex("legacy password");

        assertTrue(PasswordHasher.matches("legacy password", legacyHash));
        assertFalse(PasswordHasher.matches("wrong password", legacyHash));
        assertTrue(PasswordHasher.needsUpgrade(legacyHash));
    }

    @Test
    public void rejectsMalformedHashes() {
        assertFalse(PasswordHasher.matches("password", "not-a-hash"));
        assertFalse(PasswordHasher.matches("password", "pbkdf2-sha256$999999999$bad$bad"));
    }
}
