// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let OldSongInfo: typeof import('../../src/routes').OldSongInfo;

describe('legacy URL redirects', function () {
    beforeEach(async () => {
        vi.resetModules();

        // Importing the routes module pulls in most of the app, including modules which try to open a WebSocket
        // connection / spawn the sqlite Worker as an import side effect - neither works under jsdom so stub them out.
        vi.doMock('../../src/event-socket', () => ({
            eventSocket: {
                type: 'websocket',
                is_setup: vi.fn(),
                add_queue: vi.fn(),
                ensure_queue: vi.fn(),
                register_listener: vi.fn(),
                unregister_listener: vi.fn(),
            },
        }));
        vi.doMock('../../src/db/offline-sqlite-wasm', () => ({
            supports_browser_sqlite: false,
            try_load_sqlite_wasm: vi.fn(),
            OfflineWASMDB: class {},
        }));

        ({ OldSongInfo } = await import('../../src/routes'));
    });

    describe('OldSongInfo', function () {
        it('redirects song_id to /song/:song_id', function () {
            render(
                <MemoryRouter initialEntries={['/songinfo?song_id=123']}>
                    <Routes>
                        <Route path="/songinfo" element={<OldSongInfo />} />
                        <Route path="/song/:song_id" element={<div data-testid="song-page">Song Page</div>} />
                    </Routes>
                </MemoryRouter>,
            );

            expect(screen.getByTestId('song-page')).toBeInTheDocument();
        });

        it('redirects song_id with set_id to /song/:song_id/:set_id', function () {
            render(
                <MemoryRouter initialEntries={['/songinfo?song_id=123&set_id=456']}>
                    <Routes>
                        <Route path="/songinfo" element={<OldSongInfo />} />
                        <Route path="/song/:song_id/:set_id" element={<div data-testid="song-set-page">Song with Set</div>} />
                    </Routes>
                </MemoryRouter>,
            );

            expect(screen.getByTestId('song-set-page')).toBeInTheDocument();
        });

        it('redirects to / when no song_id is provided', function () {
            render(
                <MemoryRouter initialEntries={['/songinfo']}>
                    <Routes>
                        <Route path="/songinfo" element={<OldSongInfo />} />
                        <Route path="/" element={<div data-testid="home-page">Home</div>} />
                    </Routes>
                </MemoryRouter>,
            );

            expect(screen.getByTestId('home-page')).toBeInTheDocument();
        });
    });
});
