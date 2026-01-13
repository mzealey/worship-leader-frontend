import { Box } from '@mui/material';
import { useEffect, useRef } from 'react';

interface ContentEditableProps {
    content?: string;
    onChange?: (_content: string) => void;
    autofocus?: boolean;
}

export const ContentEditable = ({ content, onChange, autofocus }: ContentEditableProps) => {
    const elemRef = useRef<HTMLPreElement | null>(null);
    const lastContentRef = useRef<string | undefined>(undefined);

    useEffect(() => {
        if (elemRef.current && content !== undefined) {
            elemRef.current.innerHTML = content;
        }
    }, []);

    useEffect(() => {
        if (elemRef.current && content !== undefined && content !== lastContentRef.current) {
            elemRef.current.innerHTML = content;
        }
    }, [content]);

    const emitChange = () => {
        if (!elemRef.current) return;

        const newContent = elemRef.current.innerText;
        if (onChange && newContent !== lastContentRef.current) {
            onChange(newContent);
        }
        lastContentRef.current = newContent;
    };

    const onPaste = (e: React.ClipboardEvent) => {
        let text = '';

        if (e.clipboardData || (e as any).originalEvent?.clipboardData) {
            text = ((e as any).originalEvent || e).clipboardData.getData('text/plain');
        } else if ((window as any).clipboardData) {
            text = (window as any).clipboardData.getData('Text');
        }

        ['insertText', 'paste'].forEach((fn) => {
            if (document.queryCommandSupported(fn)) {
                try {
                    document.execCommand(fn, false, text);
                    e.preventDefault();
                    return;
                } catch (err) {
                    // old ff has some issue insertText per
                    // https://bugzilla.mozilla.org/show_bug.cgi?format=default&id=1130651
                    // fall through to the paste command if possible
                }
            }
        });

        // Nothing possible, don't preventDefault on the event so hopefully the
        // browser will do it itself
    };

    const onRef = (e: HTMLPreElement | null) => {
        elemRef.current = e;
        if (autofocus && e) {
            setTimeout(() => e.focus());
        }
    };

    return (
        <Box
            component="pre"
            ref={onRef}
            onPaste={onPaste}
            onInput={emitChange}
            onBlur={emitChange}
            contentEditable
            sx={{
                userSelect: 'text',
                cursor: 'text',
                fontFamily: '"Deja Vu Sans Mono", "Droid Sans Mono", "Monaco", "Courier New", Courier, mono, monospace',
            }}
        />
    );
};
