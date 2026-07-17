import { lazy, Suspense, useEffect, useState } from 'react';
import type { RouteObject } from 'react-router';
import { Navigate, Outlet, useParams, useSearchParams } from 'react-router';
import { GATracker } from './component/analytics';
import { PagesContainer } from './component/container';
import { PageList } from './page/list';
import { PageSetList } from './page/set-list';
import { PageSetView } from './page/set-view';
import { PageSettings } from './page/settings';
import { PageSongInfo } from './page/songinfo';
import type { CreateSetOptions } from './set';
import { create_set_from_url } from './set';
import { parse_search } from './splash-util.es5';

const LazyPageNativePrompter = lazy(() => import('./page/native-prompter').then((m) => ({ default: m.PageNativePrompter })));

function AppShell() {
    return (
        <GATracker>
            <Suspense fallback={null}>
                <LazyPageNativePrompter />
            </Suspense>
            <PagesContainer>
                <Outlet />
            </PagesContainer>
        </GATracker>
    );
}

function PageSongInfoWrapper() {
    const { song_id, set_id } = useParams();
    return <PageSongInfo requested_song_id={song_id ? parseInt(song_id) : undefined} set_id={set_id ? parseInt(set_id) : undefined} />;
}

function PageSetViewWrapper() {
    const { set_id } = useParams();
    return <PageSetView set_id={set_id ? parseInt(set_id) : 0} />;
}

// Exported for testing legacy URL redirects
export function OldSongInfo() {
    const [searchParams] = useSearchParams();
    let song_path = searchParams.get('song_id');
    if (!song_path) return <Navigate to="/" />;

    const set_id = searchParams.get('set_id');
    if (set_id) song_path += '/' + set_id;
    return <Navigate to={`/song/${song_path}`} />;
}

function OldSetList() {
    const [searchParams] = useSearchParams();
    const [redirect, setRedirect] = useState<string | null>(null);

    useEffect(() => {
        const search = '?' + searchParams.toString();
        const details = parse_search(search) as unknown as CreateSetOptions;
        if ((details.new_set && details.song_ids) || details.set_uuid) {
            create_set_from_url(details).then((set_id: number) => setRedirect(`/set-view/${set_id}`));
        }
    }, [searchParams]);

    return redirect ? <Navigate to={redirect} /> : null;
}

export const routes: RouteObject[] = [
    {
        Component: AppShell,
        children: [
            { index: true, Component: PageList },
            { path: 'page-list', Component: PageList },
            { path: 'song/:song_id', Component: PageSongInfoWrapper },
            { path: 'song/:song_id/:set_id', Component: PageSongInfoWrapper },
            { path: 'settings', Component: PageSettings },
            { path: 'set-list', Component: PageSetList },
            { path: 'set-view/:set_id', Component: PageSetViewWrapper },
            {
                path: 'print-songbook/:set_id',
                lazy: async () => {
                    const m = await import('./page/page-print-songbook');
                    const P = m.PagePrintSongbook;
                    return {
                        Component: () => {
                            const { set_id: sid } = useParams();
                            return <P set_id={sid ? parseInt(sid) : 0} />;
                        },
                    };
                },
            },
            {
                path: 'add-song',
                lazy: async () => {
                    const m = await import('./page/edit');
                    return { Component: () => <m.PageEditTextarea type="new" /> };
                },
            },
            {
                path: 'edit-song/:song_id',
                lazy: async () => {
                    const m = await import('./page/edit');
                    return { Component: m.PageEditSong };
                },
            },
            { path: 'songinfo', Component: OldSongInfo },
            { path: 'page-set-list', Component: OldSetList },
            { path: '*', element: <Navigate to="/" replace /> },
        ],
    },
];
