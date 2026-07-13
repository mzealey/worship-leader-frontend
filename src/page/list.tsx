import { Box } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { Fragment, useEffect } from 'react';
import side_img from '../../img/search-page-side-img.svg';
import * as Icon from '../component/icons';
import { SearchArea } from '../component/search-area';
import { SongList } from '../component/song-list';
import { TopBar } from '../component/top-bar';
import type { DBSearch } from '../db-search';
import { useSearchStore } from '../db-search';
import { useTranslation } from '../langpack';
import { usePagePadding } from '../page-padding';
import { scroll_to } from '../util';

// Attempt to reload this page with the scroll at where we were when we left
// it, very useful for mobile devices
let _last_scroll_position = 0;
let last_search: DBSearch | undefined;
const cache_scroll_position = () => (_last_scroll_position = document.documentElement.scrollTop);

// If the search changes from another page then reset our page position here
useSearchStore.subscribe((state) => {
    const { current_search } = state;
    if (last_search != current_search) {
        last_search = current_search;
        _last_scroll_position = 0;
    }
});

const side_section_width = '25vw';
const breakpoint = 'md';

export const PageList = () => {
    const { t: _t } = useTranslation();
    const verticalPagePadding = usePagePadding((state) => state.bottom + state.top);

    useEffect(() => {
        document.addEventListener('scroll', cache_scroll_position);
        scroll_to(document.documentElement, _last_scroll_position, undefined);

        return () => {
            document.removeEventListener('scroll', cache_scroll_position);
        };
    }, []);

    return (
        <Fragment>
            <Box
                sx={{
                    display: { xs: 'none', [breakpoint]: 'flex' },
                    displayPrint: 'none',
                    width: side_section_width,
                    position: 'fixed',
                    height: '100%',
                    overflow: 'hidden',
                }}
                style={{
                    height: `calc(100vh - ${verticalPagePadding}px)`,
                    flexDirection: 'column',
                    justifyContent: 'center',
                }}
            >
                <Box
                    component="img"
                    src={side_img}
                    alt=""
                    sx={{
                        position: 'absolute',
                        left: 0,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: '100%',
                        height: 'auto',
                        objectFit: 'contain',
                        pointerEvents: 'none',
                        zIndex: 0,
                    }}
                />
                <Box
                    component={Icon.Search}
                    sx={(theme) => ({
                        position: 'relative',
                        zIndex: 1,
                        color: theme.palette.primary.contrastText,
                        marginLeft: '5vw',
                        width: '5vw',
                        height: '5vw',
                    })}
                />
            </Box>

            <Box
                sx={(theme: Theme) => ({
                    [theme.breakpoints.up(breakpoint)]: {
                        marginLeft: side_section_width,
                    },
                })}
            >
                <TopBar
                    title=""
                    sx={(theme: Theme) => ({
                        [theme.breakpoints.up(breakpoint)]: {
                            left: side_section_width,
                            width: 'auto',
                        },
                    })}
                />

                <SearchArea />
                <SongList container={document} />
            </Box>
        </Fragment>
    );
};
