import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { acceptInvitation, inspectInvitation, type InvitationPreview } from '../../api/invitations';
import { setCsrfToken } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import { ADMIN_GRANTS } from '../../config/permissions';
import { departmentDashboardPath } from '../../config/departmentAdminPaths';
import { storeDepartment } from '../../config/department';
import { getErrorMessage } from '../../utils/errors';
import Button from '../../components/ui/Button';

const STORAGE_KEY = 'aces-access-invitation';
// Keep the secret out of query strings, referrer headers and server access logs.
function invitationCredentials(): { tenant: string; token: string } | null {
  const fragment = new URLSearchParams(window.location.hash.slice(1));
  if (fragment.has('token')) {
    const value = { token: fragment.get('token') || '', tenant: fragment.get('tenant') || '' };
    if (!/^[a-f0-9]{64}$/i.test(value.token) || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(value.tenant)) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    return value;
  }
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
  } catch {
    return null;
  }
}
export default function AcceptInvitationPage() {
  const [credentials] = useState(invitationCredentials);
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user, login, logout } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (window.location.hash) window.history.replaceState(window.history.state, '', window.location.pathname);
    let active = true;
    if (!credentials) {
      setError('This invitation link is missing or invalid. Ask the sender for a new invitation.');
      setLoading(false);
      return;
    }
    void inspectInvitation(credentials.tenant, credentials.token)
      .then((value) => {
        if (active) setPreview(value);
      })
      .catch((err: unknown) => {
        if (active) setError(getErrorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [credentials]);
  const matchingAccount = Boolean(
    user &&
    preview &&
    user.email.toLowerCase() === preview.invitation.email &&
    user.tenant?.slug === credentials?.tenant,
  );
  const wrongAccount = Boolean(user && !matchingAccount);
  const needsSignIn = Boolean(preview?.accountExists && !matchingAccount);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!credentials || !preview) return;
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      const result = await acceptInvitation({
        ...credentials,
        ...(preview.accountExists
          ? {}
          : {
              firstName: String(form.get('firstName')),
              lastName: String(form.get('lastName')),
              password: String(form.get('password')),
            }),
      });
      const activatedUser = { ...result.user, activeRole: preview.invitation.role };
      setCsrfToken(result.tokens.csrfToken);
      login(activatedUser, result.tokens);
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem('aces-invitation-return');
      navigate(departmentDashboardPath(activatedUser.tenant?.urlCode, activatedUser.activeRole), { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  const signIn = () => {
    if (credentials) storeDepartment(credentials.tenant);
    sessionStorage.setItem('aces-invitation-return', 'true');
  };
  const inputClass =
    'mt-1 w-full rounded-lg border border-surface-300 bg-white p-3 text-surface-900 dark:border-surface-700 dark:bg-surface-900 dark:text-white';
  return (
    <main className="min-h-screen flex items-center justify-center bg-surface-50 p-5 text-surface-900 dark:bg-surface-950 dark:text-white">
      <section className="w-full max-w-lg rounded-2xl border border-surface-200 bg-white p-7 space-y-5 shadow-sm dark:border-surface-800 dark:bg-surface-900">
        <p className="text-sm font-semibold text-primary-600">Admin Pack · Department access</p>
        <h1 className="text-2xl font-bold">Accept your invitation</h1>
        {loading && <p role="status">Checking your invitation…</p>}
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">
            {error}
          </p>
        )}
        {preview && (
          <>
            <div className="space-y-2">
              <h2 className="font-semibold text-lg">{preview.department}</h2>
              {preview.invitedBy && <p className="text-sm">Invited by {preview.invitedBy}</p>}
              {preview.approvedBy && <p className="text-sm">Authorized by {preview.approvedBy}</p>}
              <p>
                Invited email: <strong>{preview.invitation.email}</strong>
              </p>
              <p>
                Access:{' '}
                <strong>
                  {preview.invitation.role === 'hod'
                    ? 'HOD'
                    : preview.invitation.role === 'delegated_admin'
                      ? 'Delegated administrator'
                      : 'Lecturer'}
                </strong>
              </p>
              <p className="text-sm text-surface-500">
                Expires {new Date(preview.invitation.expiresAt).toLocaleString()}
              </p>
            </div>
            {preview.invitation.role === 'delegated_admin' && (
              <div>
                <h3 className="font-semibold">Approved access</h3>
                <ul className="list-disc pl-5 text-sm">
                  {ADMIN_GRANTS.filter((g) => preview.invitation.grants[g.key]).map((g) => (
                    <li key={g.key}>{g.label}</li>
                  ))}
                </ul>
                {!Object.values(preview.invitation.grants).some(Boolean) && (
                  <p>No administrative areas have been granted.</p>
                )}
                <p className="mt-2 text-sm text-surface-500">
                  These grants replace any existing admin grants on this department account.
                </p>
              </div>
            )}
            {preview.invitation.role === 'hod' && (
              <p className="text-sm">
                This grants full department authority. It does not remove an existing HOD or transfer leadership.
              </p>
            )}
            {wrongAccount && (
              <div className="space-y-3">
                <p role="alert">You are signed in with another account or department. Sign out before continuing.</p>
                <Button
                  disabled={busy}
                  variant="outline"
                  onClick={() => {
                    setBusy(true);
                    void logout().finally(() => setBusy(false));
                  }}
                >
                  Sign out
                </Button>
              </div>
            )}
            {needsSignIn && !user && (
              <div className="space-y-3">
                <p>
                  An account already exists. Sign in with the invited email, then return here to accept. This invitation
                  cannot reset an existing password.
                </p>
                <div className="flex flex-wrap gap-4">
                  <Link
                    onClick={signIn}
                    className="text-primary-600 underline"
                    to={`${preview.urlCode ? `/${preview.urlCode}/admin` : (import.meta.env.VITE_STAFF_PORTAL_PATH || '/portalsign') + '/login'}`}
                  >
                    Staff sign in
                  </Link>
                  <Link
                    onClick={signIn}
                    className="text-primary-600 underline"
                    to={preview.urlCode ? `/${preview.urlCode}` : '/login'}
                  >
                    Student / Modools sign in
                  </Link>
                </div>
              </div>
            )}
            {!wrongAccount && !needsSignIn && (
              <form onSubmit={submit} className="space-y-4">
                {!preview.accountExists && (
                  <>
                    <p>Create your account. This invitation verifies the email address above.</p>
                    <label className="block">
                      First name
                      <input
                        name="firstName"
                        autoComplete="given-name"
                        required
                        maxLength={80}
                        className={inputClass}
                      />
                    </label>
                    <label className="block">
                      Last name
                      <input
                        name="lastName"
                        autoComplete="family-name"
                        required
                        maxLength={80}
                        className={inputClass}
                      />
                    </label>
                    <label className="block">
                      Create password
                      <input
                        name="password"
                        type="password"
                        autoComplete="new-password"
                        required
                        minLength={12}
                        maxLength={72}
                        className={inputClass}
                      />
                      <span className="text-xs text-surface-500">At least 12 characters; maximum 72 bytes.</span>
                    </label>
                  </>
                )}
                <p className="text-sm text-surface-500">
                  Access is activated only when you accept. If you did not expect this invitation, you can close this
                  page.
                </p>
                <Button type="submit" disabled={busy}>
                  {busy ? 'Activating access…' : 'Accept invitation'}
                </Button>
              </form>
            )}
          </>
        )}
        <Link
          to="/login"
          onClick={() => {
            sessionStorage.removeItem(STORAGE_KEY);
            sessionStorage.removeItem('aces-invitation-return');
          }}
          className="block text-sm text-primary-600 underline"
        >
          Back to sign in
        </Link>
      </section>
    </main>
  );
}
