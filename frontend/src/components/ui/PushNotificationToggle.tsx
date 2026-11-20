import { useEffect, useState } from 'react';
import { browserPushSupported, enableBrowserPush, disableBrowserPush } from '../../hooks/browserPush';
import { deliverySetup, type DeliverySetup } from '../../api/notification-delivery';
export default function PushNotificationToggle() {
  const [setup, setSetup] = useState<DeliverySetup | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    deliverySetup()
      .then((s) => {
        if (active) setSetup(s);
      })
      .catch(() => {
        if (active) setMessage('Could not load notification service status.');
      });
    return () => {
      active = false;
    };
  }, []);
  async function change(enable: boolean) {
    setBusy(true);
    setMessage('');
    try {
      if (enable) {
        await enableBrowserPush();
        setMessage('This browser is registered. Saved push and topic preferences still control delivery.');
      } else {
        await disableBrowserPush();
        setMessage('Notifications disabled for this browser. Other devices are unchanged.');
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not update this browser.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="rounded-lg border p-4 space-y-2">
      <p className="font-semibold text-sm">Browser notification permission</p>
      <p className="text-xs">
        Email service: {setup?.email_mode || 'checking'} · Push service: {setup?.push_mode || 'checking'}. Permission
        alone is not a subscription.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          className="text-sm underline"
          disabled={busy || !browserPushSupported()}
          onClick={() => void change(true)}
        >
          Enable this browser
        </button>
        <button
          type="button"
          className="text-sm underline"
          disabled={busy || !browserPushSupported()}
          onClick={() => void change(false)}
        >
          Disable this browser
        </button>
      </div>
      {!browserPushSupported() && (
        <p className="text-xs">
          Push is unavailable here. HTTPS, a supported browser and a production service worker are required.
        </p>
      )}
      {!!message && (
        <p role="status" className="text-xs">
          {message}
        </p>
      )}
    </div>
  );
}
