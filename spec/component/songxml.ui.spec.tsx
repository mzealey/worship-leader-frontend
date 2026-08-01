import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLangpackMock } from '../helpers/mocks/langpack';

let SongXMLDisplay: typeof import('../../src/component/songxml').SongXMLDisplay;

const mockSong = {
    id: 1,
    title: 'Test Song',
    lang: 'en',
    songxml: '<song><verse><chord>C</chord>Amazing grace</verse></song>',
} as any;

describe('SongXMLDisplay', () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        vi.doMock('../../src/langpack', createLangpackMock);
        vi.doMock('../../src/settings-store', () => ({
            useSetting: (setting: string) => {
                const defaults: Record<string, any> = {
                    'display-chords': true,
                    'show-fingering': false,
                    'song-zoom': 'medium',
                    'chord-color': [255, 0, 0],
                    'observe-copyright': false,
                };
                return [defaults[setting], vi.fn()];
            },
        }));
        vi.doMock('../../src/songxml-util', () => ({
            songxml_to_divs: vi.fn().mockReturnValue('<div class="verse">Amazing grace</div>'),
            format_html_chords: vi.fn(),
        }));
        vi.doMock('../../src/transpose', () => {
            class MockTranspose {
                getNewChord(chord: string) {
                    return chord;
                }
            }
            return { Transpose: MockTranspose };
        });
        vi.doMock('../../src/solfege-util', () => ({
            maybe_convert_solfege: (s: string) => s,
        }));
        vi.doMock('../../src/util', () => ({
            is_rtl: () => false,
            is_vertical_lang: () => false,
        }));
        vi.doMock('../../src/resize-watcher', () => ({
            on_resize: vi.fn(() => ({ unsubscribe: vi.fn() })),
        }));
        vi.doMock('../../src/component/chordpopup', () => ({
            ChordPopup: () => <div data-testid="chord-popup" />,
        }));

        const mod = await import('../../src/component/songxml');
        SongXMLDisplay = mod.SongXMLDisplay;
    });

    it('renders song content', () => {
        render(<SongXMLDisplay song={mockSong} />);

        expect(document.querySelector('.songxml')).toBeInTheDocument();
        expect(document.querySelector('.songxml')?.innerHTML).toContain('Amazing grace');
    });

    it('shows no lyrics message when song has no content', async () => {
        vi.resetModules();
        vi.clearAllMocks();

        vi.doMock('../../src/langpack', createLangpackMock);
        vi.doMock('../../src/settings-store', () => ({
            useSetting: (setting: string) => {
                const defaults: Record<string, any> = {
                    'display-chords': true,
                    'show-fingering': false,
                    'song-zoom': 'medium',
                    'chord-color': [255, 0, 0],
                    'observe-copyright': false,
                };
                return [defaults[setting], vi.fn()];
            },
        }));
        vi.doMock('../../src/songxml-util', () => ({
            songxml_to_divs: vi.fn().mockReturnValue(''),
            format_html_chords: vi.fn(),
        }));
        vi.doMock('../../src/transpose', () => ({
            Transpose: class {
                getNewChord(c: string) {
                    return c;
                }
            },
        }));
        vi.doMock('../../src/solfege-util', () => ({
            maybe_convert_solfege: (s: string) => s,
        }));
        vi.doMock('../../src/util', () => ({
            is_rtl: () => false,
            is_vertical_lang: () => false,
        }));
        vi.doMock('../../src/resize-watcher', () => ({
            on_resize: vi.fn(() => ({ unsubscribe: vi.fn() })),
        }));
        vi.doMock('../../src/component/chordpopup', () => ({
            ChordPopup: () => <div data-testid="chord-popup" />,
        }));

        const mod2 = await import('../../src/component/songxml');
        const EmptyDisplay = mod2.SongXMLDisplay;

        render(<EmptyDisplay song={mockSong} />);
        expect(screen.getByText('No Lyrics')).toBeInTheDocument();
    });

    it('renders with presentation styling', () => {
        render(<SongXMLDisplay song={mockSong} in_presentation />);

        const el = document.querySelector('.songxml');
        expect(el).toBeInTheDocument();
    });

    it('renders copyright restricted message when observe_copyright is true', async () => {
        vi.resetModules();
        vi.clearAllMocks();

        vi.doMock('../../src/langpack', createLangpackMock);
        vi.doMock('../../src/settings-store', () => ({
            useSetting: (setting: string) => {
                const defaults: Record<string, any> = {
                    'display-chords': true,
                    'show-fingering': false,
                    'song-zoom': 'medium',
                    'chord-color': [255, 0, 0],
                    'observe-copyright': true,
                };
                return [defaults[setting], vi.fn()];
            },
        }));
        vi.doMock('../../src/songxml-util', () => ({
            songxml_to_divs: vi.fn().mockReturnValue('<div>content</div>'),
            format_html_chords: vi.fn(),
        }));
        vi.doMock('../../src/transpose', () => ({
            Transpose: class {
                getNewChord(c: string) {
                    return c;
                }
            },
        }));
        vi.doMock('../../src/solfege-util', () => ({
            maybe_convert_solfege: (s: string) => s,
        }));
        vi.doMock('../../src/util', () => ({
            is_rtl: () => false,
            is_vertical_lang: () => false,
        }));
        vi.doMock('../../src/resize-watcher', () => ({
            on_resize: vi.fn(() => ({ unsubscribe: vi.fn() })),
        }));
        vi.doMock('../../src/component/chordpopup', () => ({
            ChordPopup: () => <div data-testid="chord-popup" />,
        }));

        const mod2 = await import('../../src/component/songxml');
        const CopyrightDisplay = mod2.SongXMLDisplay;

        const copyrightedSong = { ...mockSong, copyright_restricted: true };
        render(<CopyrightDisplay song={copyrightedSong} />);
        expect(screen.getByText('Unfortunately, due to copyright reasons this song cannot be displayed')).toBeInTheDocument();
    });
});
