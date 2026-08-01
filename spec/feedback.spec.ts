import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('feedback', function () {
    let feedbackMod: typeof import('../src/feedback');
    let mockEventSocket: {
        add_queue: ReturnType<typeof vi.fn>;
    };
    let mockQueueFn: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        mockQueueFn = vi.fn();
        mockEventSocket = {
            add_queue: vi.fn().mockReturnValue(mockQueueFn),
        };

        vi.doMock('../src/event-socket', () => ({
            eventSocket: mockEventSocket,
        }));

        feedbackMod = await import('../src/feedback');
    });

    afterEach(() => {
        vi.resetModules();
    });

    it('creates song feedback queue on import', function () {
        expect(mockEventSocket.add_queue).toHaveBeenCalledWith('song', 500);
    });

    it('creates file feedback queue on import', function () {
        expect(mockEventSocket.add_queue).toHaveBeenCalledWith('file', 500);
    });

    it('song_feedback invokes the song queue with type and song_id', function () {
        feedbackMod.song_feedback('view', 42);

        expect(mockQueueFn).toHaveBeenCalledWith(['view', 42]);
    });

    it('file_feedback invokes the file queue with type, song_id, and file_id', function () {
        feedbackMod.file_feedback('play', 42, 7);

        expect(mockQueueFn).toHaveBeenCalledWith(['play', 42, 7]);
    });

    it('file_feedback handles string file_id', function () {
        feedbackMod.file_feedback('view', 1, 'abc123');

        expect(mockQueueFn).toHaveBeenCalledWith(['view', 1, 'abc123']);
    });
});
