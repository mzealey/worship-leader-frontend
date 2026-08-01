import { Checkbox, FormControlLabel } from '@mui/material';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

export const TristateCheckbox = ({
    onChange,
    state: externalState,
    children,
}: {
    onChange?: (_state?: 0 | 1) => void;
    state?: 0 | 1;
    children?: ReactNode;
}) => {
    const [state, setState] = useState<number | undefined>(externalState);

    useEffect(() => {
        setState(externalState);
    }, [externalState]);

    const next_state = () => {
        const cur_val = state;
        const newState = cur_val === 0 ? undefined : cur_val ? 0 : 1;
        onChange?.(newState);
        setState(newState);
    };

    return <FormControlLabel label={children} control={<Checkbox indeterminate={state === 0} checked={state === 1} onChange={next_state} />} />;
};
