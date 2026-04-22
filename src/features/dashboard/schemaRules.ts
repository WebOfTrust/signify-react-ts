export interface SchemaRuleView {
    name: string;
    value: string;
}

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const stringifiedUnknown = (value: unknown): string =>
    typeof value === 'string'
        ? value
        : JSON.stringify(value, null, 2) ?? String(value);

const flattenSchemaRuleEntries = (
    value: unknown,
    path: string,
    rows: SchemaRuleView[]
) => {
    if (isPlainRecord(value)) {
        const entries = Object.entries(value);
        if (entries.length === 0) {
            rows.push({ name: path, value: '{}' });
            return;
        }

        for (const [key, nestedValue] of entries) {
            flattenSchemaRuleEntries(nestedValue, `${path}.${key}`, rows);
        }
        return;
    }

    if (Array.isArray(value)) {
        if (value.length === 0) {
            rows.push({ name: path, value: '[]' });
            return;
        }

        value.forEach((nestedValue, index) => {
            flattenSchemaRuleEntries(nestedValue, `${path}.${index}`, rows);
        });
        return;
    }

    rows.push({ name: path, value: stringifiedUnknown(value) });
};

export const schemaRuleViews = (
    rules: Record<string, unknown> | null | undefined
): SchemaRuleView[] => {
    if (rules === undefined || rules === null) {
        return [];
    }

    const rows: SchemaRuleView[] = [];
    for (const [key, value] of Object.entries(rules)) {
        flattenSchemaRuleEntries(value, key, rows);
    }
    return rows;
};
