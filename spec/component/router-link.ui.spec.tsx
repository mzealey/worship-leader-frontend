import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { Link } from '../../src/component/router-link';

describe('Link', () => {
    it('renders as a react-router Link', () => {
        render(
            <MemoryRouter>
                <Link to="/test-path" data-testid="link">
                    Test Link
                </Link>
            </MemoryRouter>,
        );

        const link = screen.getByTestId('link');
        expect(link).toBeInTheDocument();
        expect(link).toHaveAttribute('href', '/test-path');
        expect(link).toHaveTextContent('Test Link');
    });
});
