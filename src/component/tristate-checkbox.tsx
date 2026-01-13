import { Checkbox, FormControlLabel } from '@mui/material';
import { ReactNode, useState } from 'react';

export const TristateCheckbox = ({ onChange, children }: { onChange?: (_state?: 0 | 1) => void; children?: ReactNode }) => {
    const [state, setState] = useState<number | undefined>(undefined);

    const next_state = () => {
        const cur_val = state;
        const newState = cur_val === 0 ? undefined : cur_val ? 0 : 1;
        onChange?.(newState);
        setState(newState);
    };

    return <FormControlLabel label={children} control={<Checkbox indeterminate={state === 0} checked={state === 1} onChange={next_state} />} />;
};
