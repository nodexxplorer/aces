const PushNotificationToggle = () => {
  const supported = 'Notification' in window;
  return (
    <div className="flex items-center justify-between p-4 bg-surface-50 dark:bg-surface-800 rounded-lg">
      <div>
        <p className="text-sm font-medium text-surface-900 dark:text-surface-100">Push Notifications</p>
        <p className="text-xs text-surface-500">{supported ? 'Enable browser push notifications' : 'Not supported in this browser'}</p>
      </div>
      <button
        disabled={!supported}
        onClick={() => supported && Notification.requestPermission()}
        className="px-3 py-1.5 text-xs font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 transition-colors"
      >
        Enable
      </button>
    </div>
  );
};

export default PushNotificationToggle;
