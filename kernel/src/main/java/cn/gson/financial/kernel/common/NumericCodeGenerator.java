package cn.gson.financial.kernel.common;

import java.security.SecureRandom;

/** Generates fixed-length numeric codes, including leading zeroes. */
public final class NumericCodeGenerator {

    private static final SecureRandom RANDOM = new SecureRandom();

    private NumericCodeGenerator() {
    }

    public static String generate(int length) {
        if (length <= 0) {
            throw new IllegalArgumentException("Code length must be positive");
        }

        StringBuilder value = new StringBuilder(length);
        for (int i = 0; i < length; i++) {
            value.append(RANDOM.nextInt(10));
        }
        return value.toString();
    }
}
