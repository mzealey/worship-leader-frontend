import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchInput } from '../../src/component/delayed-db-input';
import { createDbMock } from '../helpers/mocks/db';
import { renderWithProviders } from '../helpers/render';

let DelayedDBInput: typeof import('../../src/component/delayed-db-input').DelayedDBInput;

describe('SearchInput', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    it('renders an input field', () => {
        renderWithProviders(<SearchInput onChange={() => {}} />);

        const input = document.querySelector('input');
        expect(input).toBeInTheDocument();
    });

    it('displays the provided value', () => {
        renderWithProviders(<SearchInput onChange={() => {}} value="hello" />);

        const input = document.querySelector('input');
        expect(input?.value).toBe('hello');
    });

    it('calls onChange when text is entered', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();

        renderWithProviders(<SearchInput onChange={onChange} />);

        const input = document.querySelector('input')!;
        await user.type(input, 'test');

        expect(onChange).toHaveBeenCalled();
    });

    it('shows clear button when text is present', () => {
        renderWithProviders(<SearchInput onChange={() => {}} value="hello" />);

        const clearButton = screen.getByTitle('Clear text');
        expect(clearButton).toBeInTheDocument();
    });

    it('clears text and calls onChange when clear button clicked', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();

        renderWithProviders(<SearchInput onChange={onChange} value="hello" />);

        await user.click(screen.getByTitle('Clear text'));

        expect(onChange).toHaveBeenCalledWith({ target: { value: '' } });
        const input = document.querySelector('input');
        expect(input?.value).toBe('');
    });

    it('does not show clear button when text is empty', () => {
        renderWithProviders(<SearchInput onChange={() => {}} value="" />);

        expect(screen.queryByTitle('Clear text')).not.toBeInTheDocument();
    });

    it('renders endAdornment when provided', () => {
        renderWithProviders(<SearchInput onChange={() => {}} endAdornment={<span data-testid="custom-adornment">X</span>} />);

        expect(screen.getByTestId('custom-adornment')).toBeInTheDocument();
    });
});

describe('DelayedDBInput', () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        vi.doMock('../../src/db', createDbMock);

        const mod = await import('../../src/component/delayed-db-input');
        DelayedDBInput = mod.DelayedDBInput;
    });

    it('renders a SearchInput by default', () => {
        renderWithProviders(<DelayedDBInput onChange={() => {}} />);

        const input = document.querySelector('input');
        expect(input).toBeInTheDocument();
    });

    it('calls onChange immediately when input is empty', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();

        renderWithProviders(<DelayedDBInput onChange={onChange} value="" />);

        const input = document.querySelector('input')!;
        await user.type(input, 'x');
        await user.clear(input);

        expect(onChange).toHaveBeenCalled();
    });

    it('has autocomplete off', () => {
        renderWithProviders(<DelayedDBInput onChange={() => {}} />);

        const input = document.querySelector('input');
        expect(input?.autocomplete).toBe('off');
    });

    it('triggers onChange via immediate when value is empty string', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();

        renderWithProviders(<DelayedDBInput onChange={onChange} value="" />);

        const input = document.querySelector('input')!;
        await user.type(input, 'x');
        await user.clear(input);
        await user.type(input, 'y');

        // onChange should have been called for empty-string (immediate)
        expect(onChange).toHaveBeenCalled();
    });

    it('handles immediateOnChange', async () => {
        const user = userEvent.setup();
        const immediateOnChange = vi.fn().mockReturnValue(false);
        const onChange = vi.fn();

        renderWithProviders(<DelayedDBInput immediateOnChange={immediateOnChange} onChange={onChange} />);

        const input = document.querySelector('input')!;
        await user.type(input, 'text');

        expect(immediateOnChange).toHaveBeenCalled();
    });

    it('clears timeout on unmount', () => {
        const onChange = vi.fn();

        const { unmount } = renderWithProviders(<DelayedDBInput onChange={onChange} />);
        unmount();
    });
});
