// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDialog } from '../src/use-dialog';

function TestDialog({ onClose }: { onClose?: () => void }) {
    const { closed, handleClose } = useDialog(onClose);
    return (
        <div>
            <span data-testid="status">{closed ? 'closed' : 'open'}</span>
            <button data-testid="close" onClick={handleClose}>
                Close
            </button>
        </div>
    );
}

describe('useDialog', function () {
    beforeEach(() => {
        vi.clearAllMocks();
        window.location.hash = '#/test-page';
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('starts in open state', function () {
        render(
            <MemoryRouter initialEntries={['/test-page']}>
                <TestDialog />
            </MemoryRouter>,
        );
        expect(screen.getByTestId('status').textContent).toBe('open');
    });

    it('handleClose calls history.back', async function () {
        const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {});
        render(
            <MemoryRouter initialEntries={['/test-page']}>
                <TestDialog />
            </MemoryRouter>,
        );

        await userEvent.click(screen.getByTestId('close'));

        expect(backSpy).toHaveBeenCalled();
    });

    it('onClose ref updates when callback changes', async function () {
        const onClose1 = vi.fn();
        const { rerender } = render(
            <MemoryRouter initialEntries={['/test-page']}>
                <TestDialog onClose={onClose1} />
            </MemoryRouter>,
        );

        const onClose2 = vi.fn();
        rerender(
            <MemoryRouter initialEntries={['/test-page']}>
                <TestDialog onClose={onClose2} />
            </MemoryRouter>,
        );

        expect(screen.getByTestId('status').textContent).toBe('open');
    });
});
