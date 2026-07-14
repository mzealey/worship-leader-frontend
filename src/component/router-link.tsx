import { forwardRef } from 'react';
import { Link as RouterLink, type LinkProps as RouterLinkProps } from 'react-router-dom';

/**
 * Type-safe Link component for use with Material UI's component prop.
 * This wrapper ensures proper ref forwarding and type compatibility with MUI components.
 *
 * Material UI's component prop has complex type constraints that are difficult to satisfy
 * while maintaining full type safety. The type assertion here is a controlled workaround
 * that maintains runtime safety while avoiding the need for `as any` at every usage site.
 *
 * Usage: <Button component={Link} to="/path">Click me</Button>
 */
const LinkComponent = forwardRef<HTMLAnchorElement, RouterLinkProps>((props, ref) => <RouterLink ref={ref} {...props} />);

export const Link = LinkComponent as any;
