import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AutofocusTextField, DialogTitleWithClose, DropDownIcon, ImageButton, ListCheckbox, ThinPage } from '../../src/component/basic';
import * as Icon from '../../src/component/icons';
import { renderWithProviders } from '../helpers/render';

describe('ImageButton', () => {
    it('renders with icon and children text', () => {
        renderWithProviders(<ImageButton icon={Icon.Search}>Search</ImageButton>);

        expect(screen.getByText('Search')).toBeInTheDocument();
        expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('accepts size prop', () => {
        renderWithProviders(
            <ImageButton icon={Icon.Search} size="large">
                Large
            </ImageButton>,
        );

        expect(screen.getByText('Large')).toBeInTheDocument();
    });
});

describe('AutofocusTextField', () => {
    it('renders a TextField', () => {
        renderWithProviders(<AutofocusTextField placeholder="Enter text" />);

        expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
    });

    it('accepts value prop', () => {
        renderWithProviders(<AutofocusTextField value="hello" onChange={() => {}} />);

        expect(screen.getByDisplayValue('hello')).toBeInTheDocument();
    });
});

describe('DialogTitleWithClose', () => {
    it('renders title text', () => {
        renderWithProviders(
            <div data-testid="dialog">
                <DialogTitleWithClose>Dialog Title</DialogTitleWithClose>
            </div>,
        );

        expect(screen.getByText('Dialog Title')).toBeInTheDocument();
    });

    it('renders close button when handleClose provided', () => {
        const handleClose = vi.fn();

        renderWithProviders(
            <div data-testid="dialog">
                <DialogTitleWithClose handleClose={handleClose}>Title</DialogTitleWithClose>
            </div>,
        );

        expect(screen.getByLabelText('close')).toBeInTheDocument();
    });

    it('calls handleClose when close button clicked', async () => {
        const user = userEvent.setup();
        const handleClose = vi.fn();

        renderWithProviders(
            <div data-testid="dialog">
                <DialogTitleWithClose handleClose={handleClose}>Title</DialogTitleWithClose>
            </div>,
        );

        await user.click(screen.getByLabelText('close'));

        expect(handleClose).toHaveBeenCalled();
    });

    it('does not render close button when no handleClose', () => {
        renderWithProviders(
            <div data-testid="dialog">
                <DialogTitleWithClose>Title</DialogTitleWithClose>
            </div>,
        );

        expect(screen.queryByLabelText('close')).not.toBeInTheDocument();
    });
});

describe('DropDownIcon', () => {
    it('renders with collapsed=false (0deg rotation)', () => {
        renderWithProviders(<DropDownIcon collapsed={false} />);

        const icon = document.querySelector('svg');
        expect(icon).toBeInTheDocument();
        expect(icon?.style.transform).toBe('rotateX(0deg)');
    });

    it('renders with collapsed=true (180deg rotation)', () => {
        renderWithProviders(<DropDownIcon collapsed={true} />);

        const icon = document.querySelector('svg');
        expect(icon?.style.transform).toBe('rotateX(180deg)');
    });
});

describe('ListCheckbox', () => {
    it('renders a checkbox', () => {
        renderWithProviders(<ListCheckbox />);

        expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });

    it('accepts checked prop', () => {
        const onChange = vi.fn();
        renderWithProviders(<ListCheckbox checked={true} onChange={onChange} />);

        expect(screen.getByRole('checkbox')).toBeChecked();
    });
});

describe('ThinPage', () => {
    it('renders children', () => {
        renderWithProviders(
            <ThinPage>
                <span>Page content</span>
            </ThinPage>,
        );

        expect(screen.getByText('Page content')).toBeInTheDocument();
    });
});
