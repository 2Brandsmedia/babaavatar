import { memo, useEffect, useState } from 'react';
import { api } from '@renderer/lib/ipc/api';

interface VroidLoginButtonProps {
  onAuthenticated: () => void;
}

export const VroidLoginButton = memo(function VroidLoginButton({
  onAuthenticated,
}: VroidLoginButtonProps): JSX.Element {
  const [state, setState] = useState<{ configured: boolean; authenticated: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api.vroid.authState().then(setState);
  }, []);

  if (!state) return <span style={{ fontSize: 12, color: '#a0a0a8' }}>Prüfe VRoid-Status…</span>;

  if (!state.configured) {
    return (
      <span style={{ fontSize: 12, color: '#a0a0a8' }}>
        VRoid-Login optional. Für Aktivierung: VROID_CLIENT_ID / VROID_CLIENT_SECRET setzen.
      </span>
    );
  }

  if (state.authenticated) {
    return (
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: '#7af2c5' }}>Mit VRoid Hub verbunden</span>
        <button
          type="button"
          onClick={async () => {
            await api.vroid.logout();
            setState({ ...state, authenticated: false });
          }}
        >
          Abmelden
        </button>
      </div>
    );
  }

  const handleLogin = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      await api.vroid.login();
      setState({ ...state, authenticated: true });
      onAuthenticated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <button type="button" onClick={() => void handleLogin()} disabled={loading}>
        {loading ? 'Login läuft…' : 'Mit Pixiv-Account anmelden (optional)'}
      </button>
      {error && <span style={{ color: '#ff7878', fontSize: 11 }}>{error}</span>}
    </div>
  );
});
