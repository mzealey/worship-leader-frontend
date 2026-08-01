import { useCallback, useEffect, useRef, useState } from 'react';

export function useDialog(onClose?: () => void) {
    const [closed, setClosed] = useState(false);
    const onCloseRef = useRef(onClose);

    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    const handleClose = useCallback(() => {
        setClosed(true);
        onCloseRef.current?.();
    }, []);

    return {
        closed,
        handleClose,
    };
}
