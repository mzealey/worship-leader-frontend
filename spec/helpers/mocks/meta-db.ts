export interface MetaDbMockOptions {
    tagMappings?: Record<string, { id: number; tag_group: string; tag_code: string }>;
    tags?: Record<string, Record<string, string | undefined> | undefined>;
}

export function createMetaDbMock(options: MetaDbMockOptions = {}) {
    const data = {
        tag_mappings: options.tagMappings ?? {},
        tag_groups: {},
        tags: options.tags ?? {},
    };

    return {
        get_meta_db: () => Promise.resolve(data),
        refresh_meta_db: () => Promise.resolve(data),
    };
}
