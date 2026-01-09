import { Box, IconButton, InputAdornment } from '@mui/material';
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { DropDownIcon } from '../component/basic';
import { DelayedDBInput } from '../component/delayed-db-input';
import { SearchFilters } from '../component/search-filters';
import { useSearchStore } from '../db-search';
import { useTranslation } from '../langpack';
import { create_set_from_url, CreateSetOptions } from '../set';
import { updateSetting } from '../settings-store';
import { parse_search } from '../splash-util.es5';
import * as Icon from './icons';
import { Theme } from './theme';

export interface SearchAreaProps {
    thin?: boolean;
}

function SearchAreaBase(props: SearchAreaProps) {
    const { t } = useTranslation();
    const { thin } = props;

    const search = useSearchStore((state) => state.filters.search);
    const has_custom_value = useSearchStore((state) => {
        // Check if any non-default filters are set
        const { order_by: _order_by, search: _search, lang, ...otherFilters } = state.filters;
        const hasOtherFilters = Object.values(otherFilters).some((value) => value !== undefined);
        const hasNonDefaultLang = lang !== undefined && lang !== 'all';

        return Object.keys(state.sources).length > 0 || Object.keys(state.tags).length > 0 || hasOtherFilters || hasNonDefaultLang;
    });

    const [cur_value, setCurValue] = useState('');
    const [show_dropdown, setShowDropdown] = useState(false);
    const [redirect, setRedirect] = useState<any>(undefined);

    useEffect(() => {
        setCurValue(search || '');
    }, [search]);

    const immediate_search = (input: string) => {
        setCurValue(input);

        if (/^nocopyright$/i.test(input)) {
            updateSetting('observe-copyright', false);
            setCurValue('');
            return true;
        } else if (DEBUG && /^forcecopyright$/i.test(input)) {
            updateSetting('observe-copyright', true);
            setCurValue('');
            return true;
        } else if (/\bsong_id=\d+/i.test(input)) {
            // someone pasted a url of a single song
            let [, song_id] = input.match(/song_id=(\d+)/i) || [];
            setCurValue(`i${song_id}`);
            return true;
        } else if (/^\s*http.*#page-set-list.*/i.test(input)) {
            // Someone pasted set url in to the search box...
            const search = input.replace(/^\s+|\s+$/g, '').replace(/^\s*http.*#page-set-list/, '');
            const details = parse_search(search) as CreateSetOptions;

            // TODO: Merge this code with OldSetList component
            if ((details.new_set && details.song_ids) || details.set_uuid) {
                setCurValue('');
                create_set_from_url(details).then((set_id) => setRedirect({ to: `/set-view/${set_id}` }));
                return true;
            }
        }
        return false;
    };

    const updateSearch = (v: string) => {
        useSearchStore.getState().setFilters({ search: v });
        setCurValue(v);
    };

    return (
        <Box
            sx={(theme) => ({
                background: theme.palette.background.gradient,
                px: 1.25,
            })}
        >
            {redirect && <Navigate {...redirect} />}
            <DelayedDBInput
                placeholder={t('search_placeholder')}
                title={t('search_placeholder')}
                value={cur_value}
                immediateOnChange={immediate_search}
                onChange={updateSearch}
                fullWidth
                startAdornment={
                    <InputAdornment position="start">
                        <Icon.Search />
                    </InputAdornment>
                }
                endAdornment={
                    <IconButton
                        onClick={() => setShowDropdown(!show_dropdown)}
                        color={has_custom_value ? 'primary' : 'inherit'}
                        title={t('more_search_options')}
                        size="small"
                    >
                        <DropDownIcon collapsed={!show_dropdown} />
                    </IconButton>
                }
            />

            {show_dropdown && <SearchFilters thin={thin} />}
        </Box>
    );
}

export function SearchArea(props: SearchAreaProps) {
    return (
        <Theme section="Inverted">
            <SearchAreaBase {...props} />
        </Theme>
    );
}
