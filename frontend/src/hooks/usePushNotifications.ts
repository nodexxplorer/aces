export const usePushNotifications = () => {
  const isSupported = 'Notification' in window;
  const permission = isSupported ? Notification.permission : 'denied';

  const requestPermission = async () => {
    if (!isSupported) return false;
    const result = await Notification.requestPermission();
    return result === 'granted';
  };

  return { isSupported, permission, requestPermission };
};
