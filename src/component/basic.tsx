import { Button, Checkbox, DialogTitle, IconButton, TextField } from '@mui/material';
import { memo } from '../preact-helpers';
import * as Icon from './icons';

export interface ImageButtonProps extends Omit<React.ComponentProps<typeof Button>, 'component'> {
    icon: React.ComponentType<{ className?: string }>;
    size?: 'small' | 'medium' | 'large';
    children: React.ReactNode;
    iconColor?: string;
    component?: React.ElementType;
    to?: string; // For react-router Link
    [key: string]: unknown; // Allow any additional props for polymorphic components
}

export const ImageButton = memo(function ({ icon: Icon, size = 'small', children, iconColor, ...props }: ImageButtonProps) {
    if (iconColor) console.log('TODO: iconColor', iconColor);
    return (
        <Button
            size={size}
            sx={(theme) => ({
                minHeight: theme.mixins.toolbar.height,
                '& .icon': {
                    color: theme.palette.primary.icon,
                },
                // TODO: iconColor used to be looked at, needed for presenter and like stuff
            })}
            {...props}
        >
            <Icon className="icon" />
            <span className="text">{children}</span>
        </Button>
    );
});

// autoFocus only works for first mount
export function AutofocusTextField(props: React.ComponentProps<typeof TextField>) {
    return (
        <TextField
            inputRef={(e: HTMLInputElement | null) => {
                if (e) setTimeout(() => e.focus());
            }}
            {...props}
        />
    );
}

export function DialogTitleWithClose({ handleClose, children }: { handleClose?: () => void; children: React.ReactNode }) {
    return (
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 2 }}>
            <span>{children}</span>
            {handleClose && (
                <IconButton color="inherit" onClick={handleClose} aria-label="close" size="small" sx={{ ml: 2 }}>
                    <Icon.Close />
                </IconButton>
            )}
        </DialogTitle>
    );
}

export function DropDownIcon({ icon: SelectedIcon = Icon.ExpandLess, collapsed }: { icon?: React.ElementType; collapsed: boolean }) {
    return <SelectedIcon style={{ transition: 'transform 500ms linear', transform: `rotateX(${collapsed ? 180 : 0}deg)` }} />;
}

// Checkbox component for usage in a dense list
export function ListCheckbox(props: React.ComponentProps<typeof Checkbox>) {
    return (
        <Checkbox
            edge="start"
            disableRipple
            tabIndex={-1}
            color="primary"
            sx={{
                padding: '3px 9px', // shrink it a bit as size="small" doesn't work
                '&:hover': {
                    backgroundColor: 'transparent',
                },
            }}
            {...props}
        />
    );
}

export function ThinPage({ children }: { children: React.ReactNode }) {
    return <div style={{ maxWidth: '100vw', width: 500, margin: 'auto', paddingLeft: 8, paddingRight: 8 }}>{children}</div>;
}
