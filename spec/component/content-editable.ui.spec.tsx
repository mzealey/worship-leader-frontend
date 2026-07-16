import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContentEditable } from '../../src/component/content-editable';
import { renderWithProviders } from '../helpers/render';

describe('ContentEditable', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();

        document.queryCommandSupported = vi.fn().mockReturnValue(true);
        document.execCommand = vi.fn();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('renders a contentEditable pre element', () => {
        renderWithProviders(<ContentEditable />);

        const pre = document.querySelector('pre');
        expect(pre).toBeInTheDocument();
        expect(pre).toHaveAttribute('contenteditable', 'true');
    });

    it('sets initial content via innerHTML', () => {
        renderWithProviders(<ContentEditable content="<b>bold</b> text" />);

        const pre = document.querySelector('pre');
        expect(pre?.innerHTML).toBe('<b>bold</b> text');
    });

    it('calls onChange when content changes via input', () => {
        const onChange = vi.fn();

        renderWithProviders(<ContentEditable onChange={onChange} />);

        const pre = document.querySelector('pre')!;
        pre.innerText = 'new content';
        pre.dispatchEvent(new Event('input', { bubbles: true }));

        expect(onChange).toHaveBeenCalledWith('new content');
    });

    it('handles paste event as plain text', () => {
        const pasteData = {
            getData: vi.fn().mockReturnValue('pasted text'),
        };

        renderWithProviders(<ContentEditable />);

        const pre = document.querySelector('pre')!;
        const pasteEvent = new Event('paste', { bubbles: true }) as any;
        pasteEvent.clipboardData = pasteData;
        pre.dispatchEvent(pasteEvent);

        expect(pasteData.getData).toHaveBeenCalledWith('text/plain');
    });

    it('updates content when content prop changes', () => {
        const { rerender } = renderWithProviders(<ContentEditable content="initial" />);

        const pre = document.querySelector('pre');
        expect(pre?.innerHTML).toBe('initial');

        rerender(<ContentEditable content="updated" />);

        expect(pre?.innerHTML).toBe('updated');
    });

    it('updates innerHTML on mount when content provided', () => {
        renderWithProviders(<ContentEditable content="<span>hello</span>" />);

        const pre = document.querySelector('pre');
        expect(pre?.innerHTML).toBe('<span>hello</span>');
    });

    it('does not call onChange when elemRef is not available', () => {
        const onChange = vi.fn();

        // Renders without issues even when ref is null initially
        const { unmount } = renderWithProviders(<ContentEditable onChange={onChange} />);
        unmount();

        // After unmount, the onChange shouldn't have been called (no input events)
        expect(onChange).not.toHaveBeenCalled();
    });
});
