import js from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(js.configs.recommended, tseslint.configs.recommended, {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
        react,
        'react-hooks': reactHooks,
    },
    languageOptions: {
        globals: {
            // HTML ones
            ...globals.browser,
            ...globals.webextensions,

            // From cordova
            cordova: true,
            BackgroundTransfer: true,

            // From other non-es6 parts of the app
            Audio5: true,
            ToAudio: true,
            Abc: true,

            // For vitest in spec/
            global: true,
            require: true,
        },

        ecmaVersion: 'latest',
        sourceType: 'module',

        parserOptions: {
            ecmaFeatures: {
                impliedStrict: true,
                jsx: true,
            },
        },
    },

    settings: {
        react: {
            version: 'detect',
        },
    },

    rules: {
        'no-console': 0,
        'no-misleading-character-class': 0,
        'prefer-rest-params': 0,

        'react/react-in-jsx-scope': 0,
        'react/no-string-refs': 0,

        // TODO: Add this in
        'react/prop-types': 1,

        'react/jsx-no-leaked-render': ['error', { validStrategies: ['ternary', 'coerce'] }],

        'react-hooks/rules-of-hooks': 'warn',
        'react-hooks/exhaustive-deps': 'warn',

        'react/jsx-key': 'error',
        'react/self-closing-comp': 'warn',
        'react/no-unescaped-entities': 'warn',

        '@typescript-eslint/consistent-type-imports': 'warn',
        '@typescript-eslint/ban-ts-comment': ['error', { 'ts-expect-error': false, 'ts-ignore': true, 'ts-nocheck': false, 'ts-check': false }],

        'no-unused-vars': 'off', // Overridden by @typescript-eslint/no-unused-vars below
        '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '.*' }],
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-expressions': [
            'error',
            {
                allowTaggedTemplates: true,
            },
        ],
    },
});
