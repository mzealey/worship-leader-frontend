import { Snackbar } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '../langpack';
import type { UINotificationProps } from './notify';
import { _ui_notifications } from './notify';

interface NotificationProps {
    onClose: () => void;
    [key: string]: unknown;
}

const Notification = ({ onClose, ...props }: NotificationProps) => {
    const [open, setOpen] = useState(true);

    const close = () => {
        setOpen(false);
        onClose();
    };

    return <Snackbar {...props} open={open} onClose={close} />;
};

interface NotificationItem {
    autoHideDuration: number;
    message: string;
    _id: number;
    onClose: () => void;
}

export const NotificationWidget = () => {
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const { t } = useTranslation();
    const counterRef = useRef(0);

    useEffect(() => {
        const subscription = _ui_notifications.subscribe(({ autoHideDuration, message_code }: UINotificationProps) => {
            const notification: NotificationItem = {
                autoHideDuration: autoHideDuration || 4000,
                message: t(message_code),
                _id: counterRef.current++,
                onClose: () => setNotifications((prev) => prev.filter((e) => e !== notification)),
            };

            setNotifications((prev) => [...prev, notification]);
        });

        return () => {
            subscription.unsubscribe();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <>
            {notifications.map((not) => (
                <Notification key={not._id} {...not} />
            ))}
        </>
    );
};
