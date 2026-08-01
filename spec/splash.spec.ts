// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('splash.es5', function () {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();

        document.body.innerHTML = '<div id="splash-text"></div>';
    });

    afterEach(() => {
        vi.resetModules();
        document.body.innerHTML = '';
    });

    it('updates splash text with localized content', async function () {
        vi.doMock('../src/langdetect.es5', () => ({
            get_app_languages: () => ['en', 'fr'],
        }));

        vi.doMock('../langpack/worship-leader.json', () => ({
            default: { en: 'Loading...', fr: 'Chargement...' },
        }));

        await import('../src/splash.es5');

        const elem = document.getElementById('splash-text');
        expect(elem?.innerHTML).toBe('Loading...');
    });

    it('falls back to next language if first not available', async function () {
        vi.doMock('../src/langdetect.es5', () => ({
            get_app_languages: () => ['fr', 'en'],
        }));

        vi.doMock('../langpack/worship-leader.json', () => ({
            default: { en: 'Loading...', fr: 'Chargement...' },
        }));

        await import('../src/splash.es5');

        const elem = document.getElementById('splash-text');
        expect(elem?.innerHTML).toBe('Chargement...');
    });

    it('does nothing if splash-text element does not exist', async function () {
        document.body.innerHTML = '';

        vi.doMock('../src/langdetect.es5', () => ({
            get_app_languages: () => ['en'],
        }));

        vi.doMock('../langpack/worship-leader.json', () => ({
            default: { en: 'Loading...' },
        }));

        // Should not throw
        await expect(import('../src/splash.es5')).resolves.toBeDefined();
    });

    it('does nothing if no matching language found', async function () {
        vi.doMock('../src/langdetect.es5', () => ({
            get_app_languages: () => ['xx'],
        }));

        vi.doMock('../langpack/worship-leader.json', () => ({
            default: {},
        }));

        await import('../src/splash.es5');

        const elem = document.getElementById('splash-text');
        expect(elem?.innerHTML).toBe('');
    });
});
