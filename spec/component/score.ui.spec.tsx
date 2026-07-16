import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let SheetMusicDisplay: typeof import('../../src/component/score').SheetMusicDisplay;

describe('SheetMusicDisplay', () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        vi.doMock('../../src/abc2svg', () => ({
            ABC: class {
                set_audio = vi.fn();
                toggle_playing = vi.fn();
                set_instrument = vi.fn();
                render = vi.fn((_abc, el, _opts, cb: () => void) => {
                    cb();
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

        const mod = await import('../../src/component/score');
        SheetMusicDisplay = mod.SheetMusicDisplay;
    });

    it('renders without crashing', () => {
        const song = { id: 1, title: 'Test', songxml: '<song/>', abc_files: [] } as any;
        render(<SheetMusicDisplay song={song} />);
        expect(document.body).toBeInTheDocument();
    });
});
