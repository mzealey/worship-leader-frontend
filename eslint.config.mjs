import js from '@eslint/js';
// TODO: Re-enable this somehow?
//import importPlugin from 'eslint-plugin-import';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
    js.configs.recommended,
    ...tseslint.configs.recommended,
    //importPlugin.flatConfigs.recommended,
    {
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

                // From vite
                DEBUG: true,
                APP_VERSION: true,
                BUILD_TYPE: true,

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
                //pragma: 'h',
                version: 'detect',
            },
        },

        rules: {
            'no-extra-semi': 0,
            'no-console': 0,
            'no-debugger': 1,

            'no-use-before-define': [
                'error',
                {
                    functions: false,
                },
            ],

            'no-misleading-character-class': 0,

            'no-unused-vars': 'off', // Overridden by @typescript-eslint/no-unused-vars below

            'react/react-in-jsx-scope': 0,
            'react/no-string-refs': 0,

            // TODO: Add this in
            'react/prop-types': 0,

            // TODO: Fix these eventually
            'no-var': 0,
            'prefer-const': 0,
            'prefer-rest-params': 0,

            //"no-unused-vars": 1,
            //"no-redeclare": 1,
            //"no-empty": 1,

            //"dependencies/no-cycles": 1,
            //"dependencies/no-unresolved": 1,
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '.*' }],
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-expressions': [
                'error',
                {
                    allowTaggedTemplates: true,
                },
            ],
        },
    },
]);
