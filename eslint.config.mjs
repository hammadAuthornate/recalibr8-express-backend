import globals from "globals";
import pluginJs from "@eslint/js";
import tsEslint from "typescript-eslint";

/** @type {import('eslint').Linter.Config[]} */
export default [
    pluginJs.configs.recommended,
    ...tsEslint.configs.recommended,
    {
        files: ["**/*.{js,mjs,cjs,ts}"],
        ignores: ["*/abis/*", "*/test/*"],
        rules: {
            semi: "warn",
            "no-unused-vars": "warn",
            "@typescript-eslint/no-explicit-any": "warn",
        },
    },
    {
        languageOptions: { globals: globals.browser },
        rules: {
            "@typescript-eslint/no-unused-vars": "warn",
            "@typescript-eslint/no-explicit-any": "warn",
            "@typescript-eslint/no-non-null-asserted-optional-chain": "warn",
        },
    },
];
