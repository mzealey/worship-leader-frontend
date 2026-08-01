import { Subject } from 'rxjs';

export interface UINotificationProps {
    autoHideDuration?: number;
    message_code: string;
}

export const _ui_notifications = new Subject<UINotificationProps>();

export const send_ui_notification = (notification: UINotificationProps) => _ui_notifications.next(notification);
