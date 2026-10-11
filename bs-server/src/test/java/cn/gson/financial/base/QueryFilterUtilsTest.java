package cn.gson.financial.base;

import org.junit.Test;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.fail;

public class QueryFilterUtilsTest {

    @Test
    public void acceptsIdentifierFiltersAndOmitsPaginationParameters() {
        Map<String, String> parameters = new LinkedHashMap<>();
        parameters.put("account_sets_id", "12");
        parameters.put("page", "2");
        parameters.put("size", "20");

        Map<String, String> filters = QueryFilterUtils.safeEqualFilters(parameters);

        assertEquals(1, filters.size());
        assertEquals("12", filters.get("account_sets_id"));
        assertFalse(filters.containsKey("page"));
    }

    @Test
    public void rejectsSqlSyntaxInColumnNames() {
        Map<String, String> parameters = new LinkedHashMap<>();
        parameters.put("id) OR 1=1 --", "1");

        try {
            QueryFilterUtils.safeEqualFilters(parameters);
            fail("Expected invalid query field to be rejected");
        } catch (IllegalArgumentException expected) {
            assertEquals("Invalid query field", expected.getMessage());
        }
    }
}
