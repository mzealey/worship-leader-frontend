// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('starts in open state', function () {
        render(<TestDialog />);
        expect(screen.getByTestId('status').textContent).toBe('open');
    });

    it('handleClose sets closed and calls onClose', async function () {
        const onClose = vi.fn();

        render(<TestDialog onClose={onClose} />);

        await userEvent.click(screen.getByTestId('close'));

        expect(screen.getByTestId('status').textContent).toBe('closed');
        expect(onClose).toHaveBeenCalled();
    });

    it('onClose ref updates when callback changes', function () {
        const onClose1 = vi.fn();
        const { rerender } = render(<TestDialog onClose={onClose1} />);

        const onClose2 = vi.fn();
        rerender(<TestDialog onClose={onClose2} />);

        expect(screen.getByTestId('status').textContent).toBe('open');
    });

    it('calls updated onClose when handleClose is triggered after callback change', async function () {
        const onClose1 = vi.fn();
        const { rerender } = render(<TestDialog onClose={onClose1} />);

        const onClose2 = vi.fn();
        rerender(<TestDialog onClose={onClose2} />);

        await userEvent.click(screen.getByTestId('close'));

        expect(onClose1).not.toHaveBeenCalled();
        expect(onClose2).toHaveBeenCalled();
    });
});
