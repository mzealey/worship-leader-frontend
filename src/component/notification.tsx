import { Snackbar } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { Subject } from 'rxjs';
import { useTranslation } from '../langpack';

interface UINotificationProps {
    autoHideDuration?: number;
    message_code: string; // Message key to be translated
}

const _ui_notifications = new Subject<UINotificationProps>();
export const send_ui_notification = (notification: UINotificationProps) => _ui_notifications.next(notification);

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
        const subscription = _ui_notifications.subscribe((props: UINotificationProps) => {
            const { autoHideDuration, message_code } = props;
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
    }, []);

    return (
        <>
            {notifications.map((not) => (
                <Notification key={not._id} {...not} />
            ))}
        </>
    );
};
