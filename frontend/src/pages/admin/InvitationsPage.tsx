import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ADMIN_GRANTS } from '../../config/permissions';
import { useAuthStore } from '../../stores/authStore';
import {
  createInvitation,
  invitationAction,
  invitationEvents,
  listInvitations,
  type AccessInvitation,
  type InvitationEvent,
  type InviteRole,
} from '../../api/invitations';
import { getErrorMessage } from '../../utils/errors';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';

const roleLabel = (role: InviteRole) =>
  ({ lecturer: 'Lecturer', delegated_admin: 'Delegated admin', hod: 'HOD (additional access)' })[role];
export default function InvitationsPage() {
  const user = useAuthStore((s) => s.user);
  const isHOD = user?.roles?.includes('hod') || user?.role === 'hod';
  const [items, setItems] = useState<AccessInvitation[]>([]);
  const [role, setRole] = useState<InviteRole>('lecturer');
  const [grants, setGrants] = useState<AccessInvitation['grants']>({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [history, setHistory] = useState<{ id: string; events: InvitationEvent[] } | null>(null);
  const load = useCallback(async () => {
    try {
      setItems(await listInvitations());
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const item = await createInvitation({
        email: String(data.get('email')),
        name: String(data.get('name')),
        role,
        grants: role === 'delegated_admin' ? grants : {},
      });
      setNotice(
        item.status === 'pending_approval'
          ? 'Request submitted. The HOD must approve it before an access email is sent.'
          : item.deliveryFailed
            ? 'Invitation saved, but email delivery failed. Use Resend after one minute.'
            : 'Invitation email sent. The link expires in 72 hours.',
      );
      form.reset();
      setGrants({});
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  async function act(item: AccessInvitation, action: 'approve' | 'resend' | 'revoke') {
    const grantSummary =
      ADMIN_GRANTS.filter((g) => item.grants[g.key])
        .map((g) => g.label)
        .join(', ') || 'No admin permissions';
    if (
      action === 'approve' &&
      !window.confirm(
        `Approve ${item.email} as ${roleLabel(item.role)}?\n${item.role === 'delegated_admin' ? `Grants: ${grantSummary}. Acceptance replaces any existing admin grants.` : ''}\nHOD access is additional; this does not transfer leadership.`,
      )
    )
      return;
    if (action === 'revoke' && !window.confirm(`Revoke the invitation for ${item.email}?`)) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await invitationAction(item.id, action);
      setNotice(
        result.deliveryFailed
          ? 'Email delivery failed. Retry after one minute.'
          : `Invitation ${action === 'approve' ? 'approved and sent' : action === 'resend' ? 'resent; the old link is now invalid' : 'revoked'}.`,
      );
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  const inputClass =
    'w-full rounded-lg border border-surface-300 bg-white p-3 text-surface-900 dark:border-surface-700 dark:bg-surface-900 dark:text-white';
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Access invitations</h1>
        <p className="text-sm text-surface-500 mt-2">
          Invite people to your department. Admin and HOD invitations require HOD approval. Links expire after 72 hours.
        </p>
      </header>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-lg bg-blue-50 p-3 text-blue-800">
          {notice}
        </p>
      )}
      <Card>
        <form onSubmit={submit} className="space-y-4 p-4">
          <h2 className="font-semibold">Invite a person</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <label>
              Full name
              <input name="name" required maxLength={200} className={inputClass} />
            </label>
            <label>
              Email address
              <input name="email" type="email" required maxLength={255} className={inputClass} />
            </label>
            <label>
              Access
              <select
                aria-label="Access role"
                value={role}
                onChange={(e) => setRole(e.target.value as InviteRole)}
                className={inputClass}
              >
                <option value="lecturer">Lecturer</option>
                <option value="delegated_admin">Delegated admin</option>
                <option value="hod">HOD — additional access</option>
              </select>
            </label>
          </div>
          {role === 'hod' && (
            <p className="text-sm text-amber-700">
              This adds another HOD with full department authority. It does not remove or replace an existing HOD.
            </p>
          )}
          {role === 'delegated_admin' && (
            <fieldset className="space-y-2">
              <legend className="font-medium">Requested admin grants</legend>
              <p className="text-sm text-surface-500">
                Only checked areas will be granted. Accepting replaces any existing admin grant set.
              </p>
              <div className="grid gap-2 md:grid-cols-2">
                {ADMIN_GRANTS.map((g) => (
                  <label key={g.key} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(grants[g.key])}
                      onChange={(e) => setGrants((old) => ({ ...old, [g.key]: e.target.checked }))}
                    />
                    {g.label}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <Button type="submit" disabled={busy}>
            {isHOD || role === 'lecturer' ? 'Send invitation' : 'Request HOD approval'}
          </Button>
        </form>
      </Card>
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Latest 100 invitations</h2>
          <Button
            size="sm"
            variant="outline"
            disabled={busy || loading}
            onClick={() => {
              setError('');
              setLoading(true);
              void load();
            }}
          >
            Refresh
          </Button>
        </div>
        {loading ? (
          <p>Loading invitations…</p>
        ) : items.length === 0 ? (
          <p>No invitations yet.</p>
        ) : (
          items.map((item) => (
            <Card key={item.id}>
              <div className="p-4 space-y-3">
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{item.name}</h3>
                    <p>{item.email}</p>
                    <p className="text-sm text-surface-500">
                      {roleLabel(item.role)} · Expires {new Date(item.expiresAt).toLocaleString()}
                    </p>
                  </div>
                  <strong>{item.status.replace('_', ' ')}</strong>
                </div>
                {item.role === 'delegated_admin' && (
                  <p className="text-sm">
                    Grants:{' '}
                    {ADMIN_GRANTS.filter((g) => item.grants[g.key])
                      .map((g) => g.label)
                      .join(', ') || 'None'}
                  </p>
                )}
                {item.deliveryFailed && (
                  <p className="text-sm text-red-600">Email delivery failed. Check SMTP configuration and resend.</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {item.status === 'pending_approval' && isHOD && (
                    <Button size="sm" disabled={busy} onClick={() => void act(item, 'approve')}>
                      Approve and send
                    </Button>
                  )}
                  {['sent', 'expired'].includes(item.status) &&
                    !item.bootstrap &&
                    item.approvedBy &&
                    (isHOD || item.requestedBy === user?.id) && (
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => void act(item, 'resend')}>
                        Resend
                      </Button>
                    )}
                  {!['accepted', 'revoked'].includes(item.status) && (isHOD || item.requestedBy === user?.id) && (
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => void act(item, 'revoke')}>
                      Revoke
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => {
                      setError('');
                      void invitationEvents(item.id)
                        .then((events) => setHistory({ id: item.id, events }))
                        .catch((err: unknown) => setError(getErrorMessage(err)));
                    }}
                  >
                    History
                  </Button>
                </div>
                {item.bootstrap && item.status !== 'accepted' && (
                  <p className="text-sm text-surface-500">
                    First-HOD invitations can only be resent by the deployment operator.
                  </p>
                )}
                {history?.id === item.id && (
                  <ul className="text-sm space-y-1" aria-label="Invitation history">
                    {history.events.map((e, index) => (
                      <li key={index}>
                        {new Date(e.createdAt).toLocaleString()} — {e.action.replace(/_/g, ' ')}{' '}
                        {e.actorId ? `(actor ${e.actorId})` : '(system/operator)'}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          ))
        )}
      </section>
    </div>
  );
}
