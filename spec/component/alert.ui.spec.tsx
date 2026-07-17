import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLangpackMock } from '../helpers/mocks/langpack';
import { renderWithRouter } from '../helpers/render';

let Alert: typeof import('../../src/component/alert').Alert;

describe('Alert', () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();
        vi.doMock('../../src/langpack', createLangpackMock);
        vi.doMock('../../src/use-dialog', () => ({
            useDialog: (onClose?: () => void) => ({
                closed: false,
                handleClose: () => onClose?.(),
            }),
        }));
        const module = await import('../../src/component/alert');
        Alert = module.Alert;
    });

    it('renders with title and message', () => {
        renderWithRouter(<Alert title="Test Title" message="Test message body" />);
        expect(screen.getByText('Test Title')).toBeInTheDocument();
        expect(screen.getByText('Test message body')).toBeInTheDocument();
    });

    it('renders without title', () => {
        renderWithRouter(<Alert message="Just a message" />);
        expect(screen.getByText('Just a message')).toBeInTheDocument();
        expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    });

    it('closes dialog when OK is clicked', async () => {
        const user = userEvent.setup();

        renderWithRouter(<Alert message="Click OK" />);
        expect(screen.getByText('Click OK')).toBeInTheDocument();

        await user.click(screen.getByText('OK'));

        const dialogRoot = document.querySelector('.MuiDialog-root');
        expect(dialogRoot).not.toBeNull();
    });

    it('calls onClose callback when closing', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();

        renderWithRouter(<Alert message="Close me" onClose={onClose} />);

        await user.click(screen.getByText('OK'));

        expect(onClose).toHaveBeenCalled();
    });
});
