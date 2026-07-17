import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

let nextDialogId = 1;

export function useDialog(onClose?: () => void) {
    const [searchParams, setSearchParams] = useSearchParams();
    const [closed, setClosed] = useState(false);
    const dialogIdRef = useRef<string | null>(null);
    const onCloseRef = useRef(onClose);
    const initializedRef = useRef(false);
    const prevDialogRef = useRef<string | null>(null);

    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        if (!initializedRef.current) {
            initializedRef.current = true;
            const id = `d${nextDialogId++}`;
            dialogIdRef.current = id;
            const newParams = new URLSearchParams(searchParams);
            newParams.set('_dialog', id);
            setSearchParams(newParams);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const currentDialog = searchParams.get('_dialog');

    useEffect(() => {
        const prev = prevDialogRef.current;
        prevDialogRef.current = currentDialog;

        if (prev === dialogIdRef.current && currentDialog !== dialogIdRef.current && !closed) {
            setClosed(true);
            onCloseRef.current?.();
        }
    }, [currentDialog, closed]);

    const handleClose = useCallback(() => {
        window.history.back();
    }, []);

    return {
        closed,
        handleClose,
    };
}
