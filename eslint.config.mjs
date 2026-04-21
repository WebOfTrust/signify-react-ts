import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

const browserGlobals = {
    console: "readonly",
    document: "readonly",
    fetch: "readonly",
    FormData: "readonly",
    Headers: "readonly",
    Request: "readonly",
    setTimeout: "readonly",
    window: "readonly",
};

const nodeGlobals = {
    console: "readonly",
    fetch: "readonly",
    FormData: "readonly",
    process: "readonly",
    Request: "readonly",
    setTimeout: "readonly",
    URL: "readonly",
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
            "react-hooks/exhaustive-deps": "error",
            "react-hooks/set-state-in-effect": "error",
            "@typescript-eslint/no-non-null-assertion": "error",
            "@typescript-eslint/no-non-null-asserted-optional-chain": "error",
            "@typescript-eslint/no-explicit-any": "error",
            "@typescript-eslint/no-namespace": "warn",
            "@typescript-eslint/no-empty-object-type": "warn",
            "@typescript-eslint/no-unused-expressions": "error",
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                    caughtErrorsIgnorePattern: "^_",
                },
            ],
        },
    },
    {
        files: ["tests/**/*.{ts,js,mjs}", "scripts/**/*.{ts,js,mjs}", "*.config.ts"],
        languageOptions: {
            globals: nodeGlobals,
        },
        rules: {
            "prefer-const": "off",
            "no-unused-vars": "off",
            "no-empty": "warn",
            "@typescript-eslint/no-explicit-any": "error",
            "@typescript-eslint/no-non-null-assertion": "error",
            "@typescript-eslint/no-non-null-asserted-optional-chain": "error",
            "@typescript-eslint/no-unused-expressions": "error",
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                    caughtErrorsIgnorePattern: "^_",
                },
            ],
        },
    },
    eslintConfigPrettier,
];
