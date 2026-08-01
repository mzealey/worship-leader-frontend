import { useSearchStore } from './db-search';

// Set the search text, run the search straight away, and switch the site to song listing page if required
export function set_search_text(search: string) {
    useSearchStore.getState().setFilters({ search });
}
