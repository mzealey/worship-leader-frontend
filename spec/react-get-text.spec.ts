import { describe, expect, it } from 'vitest';
import { react_get_text } from '../src/react-get-text';

describe('react_get_text', function () {
    it('returns empty string for null input', function () {
        const result = react_get_text(null);
        expect(result).toBe('');
    });

    it('returns empty string for undefined input', function () {
        const result = react_get_text(undefined);
        expect(result).toBe('');
    });

    it('returns empty string for empty object', function () {
        const result = react_get_text({});
        expect(result).toBe('');
    });

    it('extracts string children from props', function () {
        const element = {
            props: {
                children: 'hello',
            },
        };

        const result = react_get_text(element);
        expect(result).toBe('hello');
    });

    it('extracts text from nested children', function () {
        const element = {
            props: {
                children: [
                    'hello ',
                    {
                        props: {
                            children: 'world',
                        },
                    },
                ],
            },
        };

        const result = react_get_text(element);
        expect(result).toBe('hello world');
    });

    it('extracts text from deeply nested children', function () {
        const element = {
            props: {
                children: {
                    props: {
                        children: {
                            props: {
                                children: 'deep',
                            },
                        },
                    },
                },
            },
        };

        const result = react_get_text(element);
        expect(result).toBe('deep');
    });

    it('returns empty string when children have no text', function () {
        const element = {
            props: {
                children: {
                    props: {
                        children: { props: {} },
                    },
                },
            },
        };

        const result = react_get_text(element);
        expect(result).toBe('');
    });

    it('handles mixed string and non-string children', function () {
        const element = {
            props: {
                children: ['hello', { props: {} }, ' world'],
            },
        };

        const result = react_get_text(element);
        expect(result).toBe('hello world');
    });
});
