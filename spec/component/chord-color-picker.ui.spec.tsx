import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ChordColorPicker } from '../../src/component/chord-color-picker';
import { renderWithProviders } from '../helpers/render';

describe('ChordColorPicker', () => {
    it('renders a color circle', () => {
        const onChange = vi.fn();
        const onOpen = vi.fn();
        const onClose = vi.fn();

        renderWithProviders(<ChordColorPicker color="#FF0000" onChange={onChange} open={false} anchorEl={null} onOpen={onOpen} onClose={onClose} />);

        expect(screen.getByTestId('chord-color-circle')).toBeInTheDocument();
    });

    it('calls onOpen when color circle is clicked', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        const onOpen = vi.fn();
        const onClose = vi.fn();

        renderWithProviders(<ChordColorPicker color="#000000" onChange={onChange} open={false} anchorEl={null} onOpen={onOpen} onClose={onClose} />);

        await user.click(screen.getByTestId('chord-color-circle'));

        expect(onOpen).toHaveBeenCalled();
    });

    it('renders popover with color grid when open', () => {
        const anchorEl = document.createElement('div');
        const onChange = vi.fn();
        const onOpen = vi.fn();
        const onClose = vi.fn();

        const { container } = renderWithProviders(
            <div>
                <ChordColorPicker color="#000000" onChange={onChange} open={true} anchorEl={anchorEl} onOpen={onOpen} onClose={onClose} />
            </div>,
        );

        // Popover renders as portal outside the root - find it in the document
        const popoverPaper = document.querySelector('.MuiPopover-paper');
        expect(popoverPaper).toBeInTheDocument();
    });

    it('calls onChange and onClose when a color is selected', async () => {
        const user = userEvent.setup();
        const anchorEl = document.createElement('div');
        const onChange = vi.fn();
        const onOpen = vi.fn();
        const onClose = vi.fn();

        renderWithProviders(
            <div>
                <ChordColorPicker color="#000000" onChange={onChange} open={true} anchorEl={anchorEl} onOpen={onOpen} onClose={onClose} />
            </div>,
        );

        // Find the first color swatch by data-testid
        const firstSwatch = screen.getByTestId('color-swatch-000000');
        await user.click(firstSwatch);

        expect(onChange).toHaveBeenCalledWith('#000000');
        expect(onClose).toHaveBeenCalled();
    });
});
