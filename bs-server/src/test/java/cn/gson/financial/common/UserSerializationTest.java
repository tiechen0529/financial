package cn.gson.financial.common;

import cn.gson.financial.kernel.model.entity.User;
import com.alibaba.fastjson.JSON;
import org.junit.Test;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;

public class UserSerializationTest {

    @Test
    public void neverSerializesOrAcceptsPasswordFields() {
        User user = new User();
        user.setPassword("password-hash");
        user.setInitPassword("initial-password");

        String json = JSON.toJSONString(user);
        assertFalse(json.contains("password"));
        assertFalse(json.contains("initPassword"));

        User parsed = JSON.parseObject(
                "{\"password\":\"attacker-value\",\"initPassword\":\"attacker-value\"}",
                User.class);
        assertNull(parsed.getPassword());
        assertNull(parsed.getInitPassword());
    }
}
