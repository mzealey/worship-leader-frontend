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
