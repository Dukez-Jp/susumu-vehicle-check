import { useState, type FormEvent } from "react";
import { ClipboardCheck, Eye, EyeOff, ShieldCheck, Truck } from "lucide-react";
import { useSession } from "../auth";
import { ErrorPanel, Notice } from "../components";
import { copy } from "../i18n";
import BrandLogo from "../branding/BrandLogo";

export default function Login() {
  const { login, expired } = useSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await login(username, password);
    } catch (failure) {
      setError(failure);
      setPassword("");
    } finally {
      setPending(false);
    }
  }
  return (
    <main className="login-page">
      <section className="login-story" aria-labelledby="welcome-title">
        <div className="susumu-brand-block">
          <BrandLogo className="susumu-group-logo--login" />
          <span>{copy.product}</span>
        </div>
        <div className="login-message">
          <h1 id="welcome-title">{copy.auth.title}</h1>
          <p>{copy.auth.subtitle}</p>
          <div className="workshop-graphic" aria-hidden="true">
            <Truck size={158} strokeWidth={1.1} />
            <div className="inspection-line">
              <ClipboardCheck size={28} />
              <span>Inspecionar. Registrar. Acompanhar.</span>
            </div>
          </div>
        </div>
        <footer>
          株式会社ススム <span>Vehicle Check</span>
        </footer>
      </section>
      <section className="login-form-area">
        <form onSubmit={submit} className="login-form">
          <div className="login-icon">
            <ShieldCheck size={26} />
          </div>
          <h2>{copy.auth.login}</h2>
          <p>Use o acesso fornecido pelo administrador da sua unidade.</p>
          {expired && <Notice tone="warning">{copy.auth.expired}</Notice>}
          {error != null && <ErrorPanel error={error} />}
          <label>
            {copy.auth.username}
            <input
              name="username"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
              autoFocus
              disabled={pending}
              maxLength={200}
            />
          </label>
          <label>
            {copy.auth.password}
            <span className="password-input">
              <input
                name="password"
                type={visible ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                disabled={pending}
                maxLength={256}
              />
              <button
                type="button"
                className="icon-button"
                aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
                aria-pressed={visible}
                onClick={() => setVisible(!visible)}
              >
                {visible ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </span>
          </label>
          <button
            className="button primary login-submit"
            disabled={pending || !username.trim() || !password}
          >
            {pending ? copy.auth.pending : copy.auth.submit}
          </button>
          <p className="session-note">
            <ShieldCheck size={16} />
            {copy.auth.memory}
          </p>
        </form>
      </section>
    </main>
  );
}
