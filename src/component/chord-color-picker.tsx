import { Box, Popover } from '@mui/material';
import { forwardRef, useCallback, useState } from 'react';

const PREDEFINED_COLORS = [
    '000000',
    '993300',
    '333300',
    '000080',
    '333399',
    '333333',
    '800000',
    'FF6600',
    '808000',
    '008000',
    '008080',
    '0000FF',
    '666699',
    '808080',
    'FF0000',
    'FF9900',
    '99CC00',
    '339966',
    '33CCCC',
    '3366FF',
    '800080',
    '999999',
    'FF00FF',
    'FFCC00',
    'FFFF00',
    '00FF00',
    '00FFFF',
    '00CCFF',
    '993366',
    'C0C0C0',
    'FF99CC',
    'FFCC99',
    'FFFF99',
    'CCFFFF',
    '99CCFF',
    'FFFFFF',
];

interface ChordColorPickerProps {
    color: string;
    onChange: (color: string) => void;
}

export const ChordColorPicker = forwardRef<HTMLDivElement, ChordColorPickerProps>(function ChordColorPicker({ color, onChange }, ref) {
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

    const handleClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    }, []);

    const handleClose = useCallback(() => {
        setAnchorEl(null);
    }, []);

    const handleSelectColor = useCallback(
        (newColor: string) => {
            onChange('#' + newColor);
            setAnchorEl(null);
        },
        [onChange],
    );

    const open = Boolean(anchorEl);

    return (
        <>
            <Box
                ref={ref}
                onClick={handleClick}
                sx={{
                    backgroundColor: color,
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    cursor: 'pointer',
                    border: '1px solid #ccc',
                    flexShrink: 0,
                }}
            />
            <Popover
                open={open}
                anchorEl={anchorEl}
                onClose={handleClose}
                anchorOrigin={{ horizontal: 'left', vertical: 'bottom' }}
                slotProps={{ paper: { sx: { p: 1 } } }}
            >
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(6, 25px)',
                        gap: '2px',
                    }}
                >
                    {PREDEFINED_COLORS.map((c) => (
                        <Box
                            key={c}
                            onClick={() => handleSelectColor(c)}
                            sx={{
                                backgroundColor: '#' + c,
                                width: 25,
                                height: 25,
                                cursor: 'pointer',
                                border: color === '#' + c ? '2px solid #000' : '1px solid #ccc',
                                '&:hover': {
                                    border: '2px solid #000',
                                },
                            }}
                        />
                    ))}
                </Box>
            </Popover>
        </>
    );
});
