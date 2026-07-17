// vite-plugin-eslint ships type declarations but its package.json "exports" map does not expose them, so TypeScript
// cannot resolve them under moduleResolution "Bundler". This mirrors node_modules/vite-plugin-eslint/dist/index.d.ts.
declare module 'vite-plugin-eslint' {
    import type { ESLint } from 'eslint';
    import type { Plugin } from 'vite';

    /** Plugin options, extending from ESlint options */
    interface Options extends ESLint.Options {
        /** Path to ESLint instance that will be used for linting */
        eslintPath?: string;
        /** Check all matching files on project startup */
        lintOnStart?: boolean;
        /** A single file, or array of files, to include when linting */
        include?: string | string[];
        /** A single file, or array of files, to exclude when linting */
        exclude?: string | string[];
        /** Custom error formatter or the name of a built-in formatter */
        formatter?: string | ESLint.Formatter['format'];
        /** The warings found will be printed */
        emitWarning?: boolean;
        /** The errors found will be printed */
        emitError?: boolean;
        /** Will cause the module build to fail if there are any warnings, based on emitWarning */
        failOnWarning?: boolean;
        /** Will cause the module build to fail if there are any errors, based on emitError */
        failOnError?: boolean;
    }

    function eslintPlugin(rawOptions?: Options): Plugin;

    export { Options, eslintPlugin as default };
}
