// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { OldSongInfo } from '../../src/routes';

describe('legacy URL redirects', function () {
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
