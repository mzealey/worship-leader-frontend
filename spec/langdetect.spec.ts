// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { get_app_languages, get_browser_languages } from '../src/langdetect.es5';
import { persistentStorage } from '../src/persistent-storage.es5';

// Remove mock for src/splash-util.es5 to test real integration

describe('langdetect', () => {
    let originalLocation: Location;

    beforeEach(() => {
        vi.resetModules();
        persistentStorage.clear();
        originalLocation = window.location;
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        // Restore window.location
        if (originalLocation) {
            Object.defineProperty(window, 'location', {
                value: originalLocation,
                writable: true,
            });
        }
    });

    const mockLanguages = (languages: string[], language: string = languages[0]) => {
        Object.defineProperty(navigator, 'languages', {
            value: languages,
            configurable: true,
        });
        Object.defineProperty(navigator, 'language', {
            value: language,
            configurable: true,
        });
        // userLanguage is non-standard but in the code
        Object.defineProperty(navigator, 'userLanguage', {
            value: language,
            configurable: true,
        });
    };

    describe('get_browser_languages', () => {
        it('detects simple language code (en)', () => {
            mockLanguages(['en']);
            const langs = get_browser_languages();
            expect(langs).toContain('en');
        });

        it('detects region specific code (en-US) and adds base language (en)', () => {
            mockLanguages(['en-US']);
            const langs = get_browser_languages();
            expect(langs).toContain('en-US');
            expect(langs).toContain('en');
        });

        it('maps specific codes (e.g. ku -> kmr)', () => {
            mockLanguages(['ku']);
            const langs = get_browser_languages();
            expect(langs).toContain('ku');
            expect(langs).toContain('kmr');
        });

        it('maps russian satellite languages to ru', () => {
            mockLanguages(['az']); // Azerbaijani
            const langs = get_browser_languages();
            expect(langs).toContain('az');
            expect(langs).toContain('ru');
        });

        it('includes languages from gup("lang")', () => {
            // Mock window.location.hash
            delete (window as any).location;
            window.location = {
                hash: '#/?lang=fr',
                protocol: 'http:',
                host: 'localhost',
            } as any;

            mockLanguages(['en']);
            const langs = get_browser_languages();
            expect(langs).toContain('fr');
            expect(langs).toContain('en');
        });

        it('includes languages from get_setting("setting-lang")', () => {
            persistentStorage.set('setting-lang', 'de');
            mockLanguages(['en']);
            const langs = get_browser_languages();
            expect(langs).toContain('de');
        });

        it('handles specific subdomain ilahiler -> tr', () => {
            // Mock window.location
            delete (window as any).location;
            window.location = {
                protocol: 'http:',
                host: 'ilahiler.example.com',
                hash: '',
            } as any;

            mockLanguages(['en']);
            const langs = get_browser_languages();
            expect(langs).toContain('tr');
        });

        it('includes extra languages if provided', () => {
            mockLanguages(['en']);
            const langs = get_browser_languages(['es']);
            expect(langs).toContain('es');
            expect(langs).toContain('en');
        });

        it('deduplicates languages', () => {
            mockLanguages(['en', 'en']);
            const langs = get_browser_languages();
            expect(langs.filter((l) => l === 'en').length).toBe(1);
        });
    });

    describe('get_app_languages', () => {
        it('includes en as fallback', () => {
            mockLanguages(['fr']);
            const langs = get_app_languages();
            expect(langs).toContain('fr');
            expect(langs).toContain('en');
        });
    });
});
