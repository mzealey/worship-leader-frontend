import { IconButton, Input, InputAdornment, InputProps } from '@mui/material';
import { ChangeEvent, ClipboardEvent, ComponentType, FocusEvent, KeyboardEvent, ReactNode, Ref, useEffect, useRef, useState } from 'react';
import { DB_AVAILABLE } from '../db';
import * as Icon from './icons';

interface SearchInputProps extends Omit<InputProps, 'onChange'> {
    onChange: (_e: ChangeEvent<HTMLInputElement> | { target: { value: string } }) => void;
    endAdornment?: ReactNode;
    value?: string;
}

export const SearchInput = ({ onChange, endAdornment, value, ...props }: SearchInputProps) => {
    const [curValue, setCurValue] = useState(value || '');
    const inputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        if (value !== undefined) {
            setCurValue(value || '');
        }
    }, [value]);

    const clearSearch = () => {
        setCurValue('');
        onChange({ target: { value: '' } });

        if (inputRef.current) {
            inputRef.current.focus();
        }
    };

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        onChange(e);
        setCurValue(e.target.value);
    };

    return (
        <Input
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            {...props}
            inputRef={inputRef}
            value={curValue}
            endAdornment={
                <InputAdornment position="end">
                    {curValue.length > 0 && (
                        <IconButton onClick={clearSearch} title="Clear text" size="small">
                            <Icon.Clear />
                        </IconButton>
                    )}
                    {endAdornment}
                </InputAdornment>
            }
            onChange={handleChange}
        />
    );
};

interface DelayedDBInputProps extends Omit<InputProps, 'onChange'> {
    immediateOnChange?: (_input: string) => boolean;
    onChange: (_input: string) => void;
    inputRef?: Ref<HTMLInputElement>;
    input?: ComponentType<any>;
    value?: string;
}

export const DelayedDBInput = ({ immediateOnChange, onChange, inputRef, input: _input, ...props }: DelayedDBInputProps) => {
    const timerRef = useRef<number | undefined>(undefined);

    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, []);

    const updated = (inputValue = '', immediate?: boolean) => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }

        if (immediateOnChange && immediateOnChange(inputValue)) {
            return;
        }

        if (immediate || inputValue === '') {
            // probably triggered from clicking the x button - search straight away
            onChange(inputValue);
        } else {
            let search_timeout = 0;
            DB_AVAILABLE.then((db) => {
                search_timeout = db.ideal_debounce();
            });
            if (search_timeout < 250) {
                search_timeout = 250;
            } else if (search_timeout > 1000) {
                search_timeout = 1000;
            }

            timerRef.current = window.setTimeout(() => onChange(inputValue), search_timeout);
        }
    };

    const InputComponent = _input || SearchInput;
    const refProps = inputRef ? { ref: inputRef } : {};

    return (
        <InputComponent
            {...props}
            {...refProps}
            onChange={(e: ChangeEvent<HTMLInputElement> | { target: { value: string } }) => updated(e.target.value)}
            onKeyUp={(e: KeyboardEvent<HTMLInputElement>) => updated(e.currentTarget.value)}
            onPaste={(e: ClipboardEvent<HTMLInputElement>) => updated(e.currentTarget.value)}
            onBlur={(e: FocusEvent<HTMLInputElement>) => updated(e.currentTarget.value, true)}
        />
    );
};
