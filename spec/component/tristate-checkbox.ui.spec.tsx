import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TristateCheckbox } from '../../src/component/tristate-checkbox';
import { renderWithProviders } from '../helpers/render';

describe('TristateCheckbox', () => {
    it('renders with children as label', () => {
        renderWithProviders(<TristateCheckbox>My Label</TristateCheckbox>);
        expect(screen.getByLabelText('My Label')).toBeInTheDocument();
    });

    it('starts unchecked', () => {
        renderWithProviders(<TristateCheckbox>Filter</TristateCheckbox>);
        const checkbox = screen.getByRole('checkbox');
        expect(checkbox).not.toBeChecked();
        expect(checkbox).not.toHaveAttribute('data-indeterminate', 'true');
    });

    it('starts checked when state=1 is passed', () => {
        renderWithProviders(<TristateCheckbox state={1}>Filter</TristateCheckbox>);
        const checkbox = screen.getByRole('checkbox');
        expect(checkbox).toBeChecked();
    });

    it('starts indeterminate when state=0 is passed', () => {
        renderWithProviders(<TristateCheckbox state={0}>Filter</TristateCheckbox>);
        const checkbox = screen.getByRole('checkbox');
        expect(checkbox).not.toBeChecked();
        expect(checkbox.getAttribute('aria-checked')).toBe('mixed');
    });

    it('cycles checked -> indeterminate -> unchecked on click', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();

        renderWithProviders(<TristateCheckbox onChange={onChange}>Cycle</TristateCheckbox>);
        const checkbox = screen.getByRole('checkbox');

        await user.click(checkbox);
        expect(checkbox).toBeChecked();
        expect(onChange).toHaveBeenLastCalledWith(1);

        await user.click(checkbox);
        expect(checkbox).not.toBeChecked();
        expect(onChange).toHaveBeenLastCalledWith(0);

        await user.click(checkbox);
        expect(checkbox).not.toBeChecked();
        expect(onChange).toHaveBeenLastCalledWith(undefined);

        expect(onChange).toHaveBeenCalledTimes(3);
    });
});
