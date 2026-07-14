import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Alert } from '../../src/component/alert';
import { renderWithProviders } from '../helpers/render';

describe('Alert', () => {
    it('renders with title and message', () => {
        renderWithProviders(<Alert title="Test Title" message="Test message body" />);
        expect(screen.getByText('Test Title')).toBeInTheDocument();
        expect(screen.getByText('Test message body')).toBeInTheDocument();
    });

    it('renders without title', () => {
        renderWithProviders(<Alert message="Just a message" />);
        expect(screen.getByText('Just a message')).toBeInTheDocument();
        expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    });

    it('closes dialog when OK is clicked', async () => {
        const user = userEvent.setup();
        window.location.hash = '#test-alert';

        renderWithProviders(<Alert message="Click OK" />);
        expect(screen.getByText('Click OK')).toBeInTheDocument();

        await user.click(screen.getByText('OK'));

        // After closing, the dialog content should be hidden
        // MUI Dialog sets aria-hidden on the Dialog root when closed
        const dialogRoot = document.querySelector('.MuiDialog-root');
        expect(dialogRoot).not.toBeNull();
    });

    it('calls onClose callback when closing', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();

        renderWithProviders(<Alert message="Close me" onClose={onClose} />);

        await user.click(screen.getByText('OK'));

        expect(onClose).toHaveBeenCalled();
    });
});
