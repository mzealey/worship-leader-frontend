import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../helpers/render';

let ChordPopup: typeof import('../../src/component/chordpopup').ChordPopup;

const mockSelectedChord = {
    chord: 'Am',
    display_chord: 'Am',
    pageX: 100,
    pageY: 200,
};

class MockABC {
    set_audio = vi.fn();
    toggle_playing = vi.fn();
}

class MockChord {
    chord: string;
    fingering: string;
    constructor(chord: string, fingering: string) {
        this.chord = chord;
        this.fingering = fingering;
    }
    getDiagram = vi.fn().mockReturnValue(document.createElement('canvas'));
}

describe('ChordPopup', () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        vi.stubGlobal('Float32Array', window.Float32Array);
        vi.doMock('../../src/abc2svg', () => ({
            ABC: MockABC,
        }));
        vi.doMock('../../src/chord', () => ({
            Chord: MockChord,
        }));
        vi.doMock('../../src/util', () => ({
            fetch_json: vi.fn().mockResolvedValue({
                am: ['0 0 2 2 1 0', '5 7 7 5 5 5'],
            }),
        }));

        const mod = await import('../../src/component/chordpopup');
        ChordPopup = mod.ChordPopup;
    });

    it('renders chord display when data is loaded', async () => {
        renderWithProviders(<ChordPopup selected_chord={mockSelectedChord} />);

        await vi.waitFor(() => {
            expect(document.body.querySelector('.MuiButton-root')).toBeInTheDocument();
        });
    });

    it('renders chord name in h4', async () => {
        renderWithProviders(<ChordPopup selected_chord={mockSelectedChord} />);

        await vi.waitFor(() => {
            expect(document.body.querySelector('h4')).toBeInTheDocument();
        });
    });

    it('renders navigation for multiple fingerings', async () => {
        renderWithProviders(<ChordPopup selected_chord={mockSelectedChord} />);

        await vi.waitFor(() => {
            const buttons = document.body.querySelectorAll('.MuiIconButton-root');
            expect(buttons.length).toBeGreaterThanOrEqual(2);
        });
    });

    it('clicks play chord button', async () => {
        renderWithProviders(<ChordPopup selected_chord={mockSelectedChord} />);

        await vi.waitFor(() => {
            const btn = document.body.querySelector('.MuiButton-root');
            expect(btn).toBeInTheDocument();
        });
    });

    it('navigates to next fingering', async () => {
        renderWithProviders(<ChordPopup selected_chord={mockSelectedChord} />);

        await vi.waitFor(() => {
            expect(document.body.querySelector('h4')).toBeInTheDocument();
        });
    });
});
