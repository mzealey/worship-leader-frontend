interface WithSortTitle {
    sort_title: string;
}

export function SORT_TITLE_SORT(a: WithSortTitle, b: WithSortTitle): -1 | 0 | 1 {
    if (a.sort_title < b.sort_title) return -1;
    if (a.sort_title > b.sort_title) return 1;
    return 0;
}

export function LOCALE_SORT(a: string, b: string) {
    return a.localeCompare(b);
}
