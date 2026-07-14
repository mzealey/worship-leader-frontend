import { useEffect, useRef, useState } from 'react';

export function useDialog(onClose?: () => void) {
    const [closed, setClosed] = useState(false);
    const startHashRef = useRef<string | null>(null);
    const onCloseRef = useRef(onClose);

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
