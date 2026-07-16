// TODO:
// - inline splash if www prod
// - Play with js minification options?
// - chrome(+ edge?) build cannot have any inline js in it...
import { viteCommonjs } from '@originjs/vite-plugin-commonjs';
import legacy from '@vitejs/plugin-legacy';
import react from '@vitejs/plugin-react';
import { copyFileSync } from 'fs';
import { defineConfig } from 'vite';
import { DynamicPublicDirectory } from 'vite-multiple-assets';
import circleDependency from 'vite-plugin-circular-dependency';
import eslint from 'vite-plugin-eslint';
import { createHtmlPlugin } from 'vite-plugin-html';
import { VitePWA } from 'vite-plugin-pwa';

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

    // TODO use import.meta.env.PROD and NODE_ENV
    const is_production = command === 'build';
    const is_watch = mode != 'test' && mode != 'serve'; // Bit of a nasty hack as --watch detail is not passed in

    process.env.VITE_BUILD_TYPE = build_type;
    process.env.VITE_DEBUG = !is_production;
    process.env.VITE_APP_VERSION = is_production ? package_conf.version : 'debug';
    //process.env.VITE_API_HOST = is_production ? 'https://songs.worshipleaderapp.com' : process.env.VITE_API_HOST;

    const config = {
        //root: 'src',
        // Copied by the DynamicPublicDirectory plugin

        //base: './',
        server: {
            // TODO: Figure out why this not working with too many open files
            //watch: null,
        },
        publicDir: false,
        optimizeDeps: {
            esbuildOptions: {},
        },
        css: {
            preprocessorOptions: {
                scss: {
                    api: 'modern-compiler',
                    // Noisy warnings go away
                    silenceDeprecations: ['slash-div', 'import', 'color-functions', 'global-builtin'],
                },
            },
        },

        build: {
            cssMinify: 'esbuild',
            reportCompressedSize: false,
            commonjsOptions: {
                include: [/abc2svg/, /node_modules/],
            },
        },

        plugins: [react({}), viteCommonjs()],

        resolve: {
            tsconfigPaths: true,
        },
    };

    // Add in linting plugins on dev only - on prod they take a long time (~70% of the runtime), and probably not
    // useful anyway.
    if(is_watch) {
        config.plugins.push(
            eslint({
                //lintOnStart: true,
                include: ['src/**/*.{js,jsx,ts,tsx}'],
            }),
            circleDependency(),
        );
    }

    if (build_type == 'phonegap') config.base = '/android_asset/www';
    if (build_type == 'www') config.base = ''; // relative base

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
                {
                    filename: 'songbook-viewer.html',
                    template: 'songbook-viewer.html',
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

            createHtmlPlugin(html_config),
        );

        // TODO: The legacy shim seems to break phonegap build for some reason on my phone - causes the js to load twice
        if (build_type == 'www' && mode != 'test') {
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
            if (filePath.endsWith('.woff2')) return false;
            return content.length < 7000;
        };

        config.build.rollupOptions = {
            output: {
                manualChunks(id) {
                    if (id.includes('node_modules/@mui/') || id.includes('node_modules/@emotion/')) return 'vendor-mui';
                    if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/react-router/'))
                        return 'vendor-react';
                    if (id.includes('node_modules/@dnd-kit/')) return 'vendor-dnd';
                    if (id.includes('node_modules/zustand/')) return 'vendor-zustand';
                    if (id.includes('node_modules/rxjs/')) return 'vendor-rxjs';
                },
                assetFileNames: ({ names, originalFileNames }) => {
                    if (originalFileNames.length == 1) {
                        if (originalFileNames[0].endsWith('.wasm')) return originalFileNames[0];
                        else if (/^fonts\//.test(originalFileNames[0])) return originalFileNames[0];
                    }
                    return 'assets/[name]-[hash][extname]';
                },
            },
        };

        config.build.rolldownOptions = {
            output: {
                codeSplitting: true,
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
                        'songbook-viewer.html',

                        // Ensure sqlite works offline correctly
                        '**/*.wasm',

                        // Cache a few fonts, the rest will be automatically cached
                        // if used. woff2 support is basically the same as service worker
                        // browser support so prefetching should be good.
                        'fonts/misc-symbols.woff2',

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

    return config;
});
