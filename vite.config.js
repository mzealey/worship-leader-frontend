// TODO:
// - inline splash if www prod
// - Check dual screen is working as expected
// - Play with js minification options?
// - chrome(+ edge?) build cannot have any inline js in it...
import { viteCommonjs } from '@originjs/vite-plugin-commonjs';
import legacy from '@vitejs/plugin-legacy';
import { copyFileSync } from 'fs';
import { defineConfig } from 'vite';
import { DynamicPublicDirectory } from 'vite-multiple-assets';
import circleDependency from 'vite-plugin-circular-dependency';
import eslint from 'vite-plugin-eslint';
import { createHtmlPlugin } from 'vite-plugin-html';
import { VitePWA } from 'vite-plugin-pwa';
import tsconfigPaths from 'vite-tsconfig-paths';
import { resolveDependencyPaths } from './vite-plugin-resolve-deps.js';

const font_versions = {
    www: 'woff2, woff, ttf',
    chrome: 'woff2',
    edge: 'woff2',
    phonegap: 'woff', // android 4.4+ supports this
    editor: 'woff',
};
const package_conf = require('./package.json');
const browserslist = {
    // Let www build use the default targets from package.json
    www: package_conf.browserslist,
    chrome: 'since 2023 and chrome > 0',
    edge: 'since 2023 and edge > 0',
    phonegap: [
        'since 2019 and chrome > 0', // cordova-android 12
        'ios >= 11', // cordova-ios 7
    ],
    editor: ['last 2 versions', 'last 10 chrome versions', 'since 2020', 'not ie <= 11'],
};

export default defineConfig(({ command, mode }) => {
    const build_type = mode == 'development' || mode == 'test' ? 'www' : mode;
    if (!build_type) throw new Error('Must specify build type eg --mode=www');

    const is_production = command == 'build';
    const is_watch = mode != 'test' && mode != 'serve'; // Bit of a nasty hack as --watch detail is not passed in

    const config = {
        //root: 'src',
        // Copied by the DynamicPublicDirectory plugin

        //base: './',
        publicDir: false,
        optimizeDeps: {
            esbuildOptions: {},
        },
        define: {
            BUILD_TYPE: JSON.stringify(build_type),
            DEBUG: is_production ? 0 : 1,
            APP_VERSION: JSON.stringify(is_production ? package_conf.version : 'debug'),
        },
        css: {
            preprocessorOptions: {
                scss: {
                    additionalData: `$font-versions: (${font_versions[build_type]});`,
                    api: 'modern-compiler',
                    // Noisy warnings go away
                    silenceDeprecations: ['slash-div', 'import', 'color-functions', 'global-builtin'],
                },
            },
        },

        build: {
            reportCompressedSize: false,
            commonjsOptions: {
                include: [/abc2svg/, /node_modules/],
            },
        },

        plugins: [viteCommonjs(), tsconfigPaths()],
    };

    // Add in linting plugins. TODO: Disable on production build would reduce time from 21 to 15sec
    config.plugins.push(
        // TODO: Can take a while - don't run in some contexts?
        eslint({
            //lintOnStart: true,
            include: ['src/**/*.{js,jsx,ts,tsx}'],
        }),
        circleDependency(),
    );

    if (build_type == 'phonegap') config.base = '/android_asset/www';

    if (build_type == 'editor') {
        config.build.rollupOptions = {
            input: {
                'common-functions': 'src/common-functions.js',
            },
            output: {
                entryFileNames: '[name].js',
            },
        };
        config.build.copyPublicDir = false;
        config.esbuild = {
            minifyIdentifiers: false,
        };
    } else {
        const html_config = {
            pages: [
                {
                    filename: 'index.html',
                    template: 'index.html',
                    injectOptions: {
                        data: {
                            htmlWebpackPlugin: {
                                options: {
                                    build: build_type,
                                    is_production,
                                },
                            },
                        },
                    },
                },
                {
                    filename: 'presentor.html',
                    template: 'presentor.html',
                },
            ],
        };

        if (is_production && build_type == 'www') {
            // The html templater is not great but it's the best we have. Seems like it cannot support multiple outputs
            // from the same template for some reason so we have to hack-copy the file.
            copyFileSync('index.html', 'song_templ.tt.html');
            html_config.pages.push({
                filename: 'song_templ.tt.html',
                template: 'song_templ.tt.html',
                injectOptions: {
                    data: {
                        htmlWebpackPlugin: {
                            options: {
                                build: 'live',
                                is_production,
                            },
                        },
                    },
                },
            });

            // Pre-build compressed versions of the files for faster serving from the server
            // Works fine, but probably no need with apache, only on nginx
            /*
            config.plugins.push(
                viteCompression({ verbose: false }),
                viteCompression({ algorithm: 'brotliCompress', verbose: false }),
            );
            */
        }

        config.plugins.push(
            // Additional public directory on a per-build basis to allow eg public-www specifically for the www build
            DynamicPublicDirectory(
                [
                    {
                        input: `public/all/**`,
                        watch: is_watch,
                    },
                    {
                        input: `public/${build_type}/**`,
                        watch: is_watch,
                    },
                ],
                {
                    followSymlinks: true,
                },
            ),

            // Resolve dependency path references in public files (play-1.js, jquery.min.js, etc.)
            resolveDependencyPaths(),

            createHtmlPlugin(html_config),
        );

        // TODO: The legacy shim seems to break phonegap build for some reason on my phone - causes the js to load twice
        if (build_type == 'www') {
            //|| build_type == 'phonegap' ) {
            config.plugins.push(
                legacy({
                    // Per https://dev.to/solleedata/supporting-older-browsers-using-vite-2ii
                    targets: browserslist[build_type],
                    // TODO: Is this needed? Likely not given the age of our code.
                    //modernPolyfills: true,
                }),
            );

            // For supporting 'legacy' functionality, don't worry about sqlite using bigints - it auto-falls back to web
            // API if problematic
            config.esbuild = {
                supported: { bigint: true },
            };
        }

        config.build.assetsInlineLimit = (filePath, content) => {
            // Stuff to never inline. We could use ?no-inline but this then breaks sw caching
            if (filePath.endsWith('.ttf') || filePath.endsWith('.woff') || filePath.endsWith('.woff2')) return false;
            return content.length < 7000;
        };

        config.build.rollupOptions = {
            output: {
                assetFileNames: ({ names, originalFileNames }) => {
                    //console.log('originalFileNames', originalFileNames, names);
                    if (originalFileNames.length == 1) {
                        // Things that we don't want to rename and want to retain paths for
                        if (originalFileNames[0].endsWith('.wasm')) return originalFileNames[0];
                        else if (/^fonts\//.test(originalFileNames[0])) return originalFileNames[0];
                    }
                    return 'assets/[name]-[hash][extname]';
                },
            },
        };
    }

    if (is_production && build_type == 'www') {
        config.plugins.push(
            VitePWA({
                registerType: 'autoUpdate',
                workbox: {
                    globIgnores: [
                        // Ignore legacy polyfills
                        '**/*legacy*.js',
                        '**/song_templ*',
                    ],

                    globPatterns: [
                        // The default which we now overrode.
                        '**/*.{js,css}',

                        'index.html',
                        'presentor.html',

                        // Ensure sqlite works offline correctly
                        '**/*.wasm',

                        // Cache a few fonts, the rest will be automatically cached
                        // if used. woff2 support is basically the same as service worker
                        // browser support so prefetching should be good.
                        'fonts/misc-symbols.woff2',
                        'fonts/stave.woff2',

                        'chords.json',
                        'silence.mp3', // safari hack only...

                        // favicons
                        'assets/worshipleader-*.png',
                        'icon-192.png',
                        'icon-512.png',

                        // Always have fallback language items cached, but the others will only be
                        // cached on request.
                        'langpack/en.json',
                        'splashscreens/en.jpg',

                        // Generated by util/list_current_unidecode_pages.pl based
                        // on chars in the database Cache the most commonly used
                        // unidecode pages
                        'unidecode/data/x00.json',
                        'unidecode/data/x01.json',
                        'unidecode/data/x02.json',
                        'unidecode/data/x04.json',
                        'unidecode/data/x05.json',
                        'unidecode/data/x06.json',
                        'unidecode/data/x0e.json',
                        'unidecode/data/x18.json',
                        'unidecode/data/x20.json',
                        'unidecode/data/x4e.json',
                        'unidecode/data/x4f.json',
                        'unidecode/data/x54.json',
                        'unidecode/data/x57.json',
                        'unidecode/data/x59.json',
                        'unidecode/data/x5f.json',
                        'unidecode/data/x62.json',
                        'unidecode/data/x65.json',
                        'unidecode/data/x67.json',
                        'unidecode/data/x76.json',
                        'unidecode/data/xff.json',
                    ],
                },
                manifest: require('./web-manifest.json'),
            }),
        );
    }

    // vitest config
    config.test = {
        environment: 'jsdom',
        environmentOptions: {
            jsdom: {
                html: '<!doctype html><html><body></body></html>',
            },
        },
        setupFiles: ['./spec/setup.ts'],
        coverage: {
            include: ['src/**'],
        },
        // Enable web workers in tests
        pool: 'threads',
        poolOptions: {
            threads: {
                useAtomics: true,
            },
        },
    };

    return config;
});
