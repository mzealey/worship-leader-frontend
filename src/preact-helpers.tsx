import clsx from 'clsx';
export { clsx };

export { createContext, Fragment, memo, useContext, useEffect, useRef, useState } from 'react';

export { alpha as fade } from '@mui/material';
export { useCallback } from 'react';

import { forwardRef, useEffect, useRef, useState } from 'react';
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

interface ReactLikeObject {
    props?: {
        children?: ReactLikeObject | ReactLikeObject[] | string;
    };
}

// given a react object extract the textual strings from it - like jquery's $(element).text(). TODO: Aim to remove this
export function preact_get_text(element: unknown): string {
    function walk(object: unknown, iterator: (value: unknown, object: unknown) => void): void {
        const obj = object as ReactLikeObject;
        if (obj && obj.props && obj.props.children) {
            ([] as unknown[]).concat(obj.props.children).forEach((value) => {
                iterator(value, obj);
                walk(value, iterator);
            });
        }
    }

    let str = '';
    walk(element, (obj: unknown) => {
        if (typeof obj === 'string') str += obj;
    });
    return str;
}

export function useDialog(onClose?: () => void) {
    const [closed, setClosed] = useState(false);
    const startHashRef = useRef<string | null>(null);
    const onCloseRef = useRef(onClose);

    // Keep the onClose ref up to date
    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        if (!closed && !startHashRef.current) {
            startHashRef.current = window.location.hash;
            window.location.hash += '?dialog';

            const handlePopstate = (ev: PopStateEvent) => {
                console.log('close', ev);
                if (window.location.hash === startHashRef.current) {
                    window.removeEventListener('popstate', handlePopstate);
                    setClosed(true);
                    onCloseRef.current?.();
                }
            };

            window.addEventListener('popstate', handlePopstate);

            return () => {
                window.removeEventListener('popstate', handlePopstate);
            };
        }
    }, [closed]);

    const handleClose = () => {
        window.history.back();
    };

    return {
        closed,
        handleClose,
    };
}
