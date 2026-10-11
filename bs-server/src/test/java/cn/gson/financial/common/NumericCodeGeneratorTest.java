package cn.gson.financial.common;

import cn.gson.financial.kernel.common.NumericCodeGenerator;
import org.junit.Test;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.fail;

public class NumericCodeGeneratorTest {

    @Test
    public void generatesFixedLengthDigits() {
        String code = NumericCodeGenerator.generate(6);

        assertEquals(6, code.length());
        if (!code.matches("[0-9]{6}")) {
            fail("Generated code must contain only digits");
        }
    }

    @Test(expected = IllegalArgumentException.class)
    public void rejectsInvalidLengths() {
        NumericCodeGenerator.generate(0);
    }
}
