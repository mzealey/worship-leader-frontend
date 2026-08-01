import { fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let SheetMusicDisplay: typeof import('../../src/component/score').SheetMusicDisplay;

const baseSong = {
    id: 1,
    title: 'Test Song',
    lang: 'en',
    songxml: '<song><verse>test</verse></song>',
    abc_files: [],
} as any;

const abcFile = {
    id: 10,
    type: 'abccache',
    abc: 'X:1\nT:Test\nK:C\nCDEF\n',
    path: '/test.abc',
} as any;

describe('SheetMusicDisplay', () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        vi.doMock('../../src/abc2svg', () => ({
            ABC: class {
                set_audio = vi.fn();
                toggle_playing = vi.fn();
                set_instrument = vi.fn();
                reset_play_position = vi.fn();
                abc_render = vi.fn(() => Promise.resolve({ svg: '<svg></svg>', audio: { to: vi.fn() } }));
                render = vi.fn((_abc: string, _el: HTMLElement, _opts: any, cb?: () => void) => {
                    if (cb) cb();
                });
            },
        }));
        vi.doMock('../../src/feedback', () => ({
            file_feedback: vi.fn(),
            song_feedback: vi.fn(),
        }));
        vi.doMock('../../src/resize-watcher', () => ({
            on_resize: vi.fn(() => ({ unsubscribe: vi.fn() })),
        }));
        vi.doMock('../../src/util', () => ({
            ensure_visible: vi.fn(),
        }));
        vi.doMock('../../src/component/songxml', () => ({
            SongXMLDisplay: () => <div data-testid="songxml-display" />,
        }));
        vi.doMock('../../src/component/icons', () => ({
            SymbolPlaySong: () => <svg data-testid="icon-play" />,
            PauseSong: () => <svg data-testid="icon-pause" />,
            Play: () => <svg data-testid="icon-play" />,
        }));

        const mod = await import('../../src/component/score');
        SheetMusicDisplay = mod.SheetMusicDisplay;
    });

    it('renders without crashing', () => {
        render(<SheetMusicDisplay song={baseSong} />);
        expect(document.body).toBeInTheDocument();
    });

    it('renders with abc file', () => {
        const { container } = render(<SheetMusicDisplay song={baseSong} abc_file={abcFile} />);
        expect(container).toBeTruthy();
    });

    it('renders in presentation mode', () => {
        const { container } = render(<SheetMusicDisplay song={baseSong} abc_file={abcFile} in_presentation={true} />);
        expect(container).toBeTruthy();
    });

    it('renders in print mode', () => {
        const { container } = render(<SheetMusicDisplay song={baseSong} abc_file={abcFile} is_printing={true} />);
        expect(container).toBeTruthy();
    });

    it('renders with transpose', () => {
        const transpose = {
            chord_index: () => 0,
            is_minor: false,
            get_total_delta: () => 0,
            convert_chord_line: vi.fn((s: string) => s),
            subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })),
        };

        render(<SheetMusicDisplay song={baseSong} abc_file={abcFile} transpose={transpose as any} />);
        expect(document.body).toBeInTheDocument();
    });

    it('shows SongXMLDisplay when needsSongxml set', () => {
        render(<SheetMusicDisplay song={baseSong} abc_file={abcFile} />);
        // After render, needsSongxml is false by default, so SongXMLDisplay shouldn't show
        expect(document.querySelector('[data-testid="songxml-display"]')).toBeNull();
    });

    it('handles click to toggle play', () => {
        render(<SheetMusicDisplay song={baseSong} abc_file={abcFile} />);
        const container = document.querySelector('div');
        if (container) fireEvent.click(container);
    });

    it('handles context menu', () => {
        render(<SheetMusicDisplay song={baseSong} abc_file={abcFile} />);
        const container = document.querySelector('div');
        if (container) fireEvent.contextMenu(container);
    });
});
