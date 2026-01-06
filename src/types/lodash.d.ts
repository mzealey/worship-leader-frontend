declare module 'lodash/isEqual' {
    type EqualityValue = unknown;
    function isEqual(value: EqualityValue, other: EqualityValue): boolean;
    export = isEqual;
}

declare module 'lodash/debounce' {
    function debounce<T extends (...args: unknown[]) => unknown>(
        func: T,
        wait?: number,
        options?: {
            leading?: boolean;
            maxWait?: number;
            trailing?: boolean;
        },
    ): T & {
        cancel(): void;
        flush(): void;
    };
    export = debounce;
}
