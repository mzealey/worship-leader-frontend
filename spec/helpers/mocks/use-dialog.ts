export function createUseDialogMock() {
    return {
        useDialog: (onClose?: () => void) => ({
            closed: false,
            handleClose: () => onClose?.(),
        }),
    };
}
