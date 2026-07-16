import { describe, expect, it } from 'vitest';
import { useSearchStore, useSongListStore } from '../src/db-search';

describe('db-search stores', () => {
    describe('useSongListStore', () => {
        it('initializes with empty items', () => {
            const state = useSongListStore.getState();
            expect(state.items).toEqual([]);
            expect(state.requested_items).toBeUndefined();
            expect(state.pager).toBeUndefined();
        });

        it('setSongList updates items', () => {
            const pager = { total: 10 };
            const items = [{ id: 1, title: 'Song 1' }] as any[];
            useSongListStore.getState().setSongList(items, { start: 0, size: 10 }, pager as any);
            const state = useSongListStore.getState();
            expect(state.items).toEqual(items);
            expect(state.pager).toBe(pager);
        });

        it('setPager updates pager', () => {
            const pager = { total: 5 };
            useSongListStore.getState().setPager(pager as any);
            expect(useSongListStore.getState().pager).toBe(pager);
        });
    });

    describe('useSearchStore', () => {
        it('initializes with default filters', () => {
            const state = useSearchStore.getState();
            expect(state.filters).toBeDefined();
            expect(state.tags).toBeDefined();
            expect(state.sources).toBeDefined();
        });

        it('setFilters updates search filter', () => {
            useSearchStore.getState().setFilters({ search: 'test' });
            expect(useSearchStore.getState().filters.search).toBe('test');
        });

        it('updateSourceFilter sets sources', () => {
            useSearchStore.getState().updateSourceFilter({ 1: 1 });
            expect(useSearchStore.getState().sources[1]).toBe(1);
        });

        it('resetSourceFilter clears sources', () => {
            useSearchStore.getState().updateSourceFilter({ 1: 1 });
            useSearchStore.getState().resetSourceFilter();
            expect(useSearchStore.getState().sources).toEqual({});
        });

        it('updateTagFilter sets tags', () => {
            useSearchStore.getState().updateTagFilter({ 1: 1 });
            expect(useSearchStore.getState().tags[1]).toBe(1);
        });

        it('resetTagFilter clears tags', () => {
            useSearchStore.getState().updateTagFilter({ 1: 1 });
            useSearchStore.getState().resetTagFilter();
            expect(useSearchStore.getState().tags).toEqual({});
        });

        it('setCurrentSearch sets current search', () => {
            const search = {} as any;
            useSearchStore.getState().setCurrentSearch(search);
            expect(useSearchStore.getState().current_search).toBe(search);
        });
    });
});
