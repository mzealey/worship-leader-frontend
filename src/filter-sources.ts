import { useSearchStore } from './db-search';

export function toggle_filter_source(source_id: number, with_reset?: boolean, state?: boolean) {
    if (with_reset) useSearchStore.getState().resetSourceFilter();

    // If state is explicitly provided, use it; otherwise toggle based on current presence
    const currentSources = useSearchStore.getState().sources;
    const targetState = state !== undefined ? state : !(source_id in currentSources);

    useSearchStore.getState().updateSourceFilter({ [source_id]: targetState ? 1 : undefined });
}
