import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

const browserGlobals = {
    console: "readonly",
    document: "readonly",
    fetch: "readonly",
    Headers: "readonly",
    setTimeout: "readonly",
    window: "readonly",
};

export default [
    {
        ignores: ["dist"],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ["src/**/*.{ts,tsx}"],
        languageOptions: {
            globals: browserGlobals,
        },
        plugins: {
            "react-hooks": reactHooks,
            "react-refresh": reactRefresh,
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            "react-refresh/only-export-components": [
                "warn",
                { allowConstantExport: true },
            ],
            "prefer-const": "off",
            "no-unused-vars": "off",
            "no-unused-expressions": "off",
            "no-var": "warn",
            "no-self-assign": "warn",
            "no-case-declarations": "warn",
            "no-constant-condition": "warn",
            "no-empty": "warn",
            "react-hooks/exhaustive-deps": "off",
            "react-hooks/set-state-in-effect": "off",
            "@typescript-eslint/no-non-null-asserted-optional-chain": "warn",
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-namespace": "warn",
            "@typescript-eslint/no-empty-object-type": "warn",
            "@typescript-eslint/no-unused-expressions": "off",
            "@typescript-eslint/no-unused-vars": "off",
        },
    },
    eslintConfigPrettier,
];
