package cn.gson.financial.base;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Pattern;

/** Validates client-supplied column names before they are used in MyBatis wrappers. */
public final class QueryFilterUtils {

    private static final Pattern COLUMN_NAME = Pattern.compile("[A-Za-z_][A-Za-z0-9_]*");

    private QueryFilterUtils() {
    }

    public static Map<String, String> safeEqualFilters(Map<String, String> parameters) {
        Map<String, String> filters = new LinkedHashMap<>();
        for (Map.Entry<String, String> parameter : parameters.entrySet()) {
            String column = parameter.getKey();
            if ("page".equals(column) || "size".equals(column)) {
                continue;
            }
            if (column == null || !COLUMN_NAME.matcher(column).matches()) {
                throw new IllegalArgumentException("Invalid query field");
            }
            filters.put(column, parameter.getValue());
        }
        return filters;
    }
}
