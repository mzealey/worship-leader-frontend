import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.js';

const baseConfig = typeof viteConfig === 'function' ? viteConfig({ command: '', mode: 'test' }) : viteConfig;

export default defineConfig(
    mergeConfig(baseConfig, {
        test: {
            globals: true,
            environment: 'jsdom',
            environmentOptions: {
                jsdom: {
                    html: '<!doctype html><html><body></body></html>',
                },
            },
            setupFiles: ['spec/setup.ts'],
            coverage: {
                include: ['src/**'],
                exclude: ['src/**/*.d.ts', 'src/**/*.scss'],
                provider: 'v8',
                reporter: ['text', 'lcov'],
            },
            pool: 'threads',
        },
    }),
);
