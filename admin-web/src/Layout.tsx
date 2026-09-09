import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  ClipboardCheck,
  Building2,
  ContactRound,
  Files,
  LayoutDashboard,
  ListTree,
  LogOut,
  Menu,
  ShieldCheck,
  Truck,
  Users,
  WifiOff,
  X,
} from "lucide-react";
import { useSession, useUser } from "./auth";
import { copy } from "./i18n";

export default function Layout() {
  const user = useUser();
  const { logout } = useSession();
  const [menu, setMenu] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  const links = [
    { to: "/", label: copy.nav.dashboard, icon: LayoutDashboard, show: true },
    { to: "/vehicles", label: copy.nav.vehicles, icon: Truck, show: true },
    {
      to: "/vehicle-types",
      label: copy.nav.vehicleTypes,
      icon: ListTree,
      show: user.role === "Administrator",
    },
    {
      to: "/inspections",
      label: copy.nav.inspections,
      icon: ClipboardCheck,
      show: true,
    },
    { to: "/templates", label: copy.nav.templates, icon: Files, show: true },
    {
      to: "/users",
      label: copy.nav.users,
      icon: Users,
      show: user.role === "Administrator",
    },
    {
      to: "/employees",
      label: copy.nav.employees,
      icon: ContactRound,
      show: user.role === "Administrator",
    },
    {
      to: "/organization",
      label: copy.nav.organization,
      icon: Building2,
      show: user.role === "Administrator",
    },
    {
      to: "/audit",
      label: copy.nav.audit,
      icon: ShieldCheck,
      show: ["Administrator", "Supervisor"].includes(user.role),
    },
  ];
  return (
    <div className="app-layout">
      <a className="skip-link" href="#main">
        Pular para o conteúdo
      </a>
      <button
        className="mobile-menu icon-button no-print"
        onClick={() => setMenu(!menu)}
        aria-label={menu ? "Fechar menu" : "Abrir menu"}
        aria-expanded={menu}
      >
        {menu ? <X /> : <Menu />}
      </button>
      {menu && (
        <button
          className="menu-backdrop"
          aria-label="Fechar menu"
          onClick={() => setMenu(false)}
        />
      )}
      <aside className={`sidebar no-print ${menu ? "open" : ""}`}>
        <LinkBrand />
        <nav aria-label="Navegação principal">
          {links
            .filter((link) => link.show)
            .map((link) => (
              <NavLink
                to={link.to}
                end={link.to === "/"}
                key={link.to}
                onClick={() => setMenu(false)}
              >
                <link.icon size={20} />
                <span>{link.label}</span>
              </NavLink>
            ))}
        </nav>
        <div className="sidebar-note">
          <ShieldCheck size={19} />
          <p>
            Histórico preservado.
            <br />
            Cada inspeção conta.
          </p>
        </div>
        <div className="user-panel">
          <span className="avatar">{user.name.trim().slice(0, 1)}</span>
          <div>
            <strong>{user.name}</strong>
            <span>{copy.role[user.role]}</span>
          </div>
          <button
            className="icon-button"
            title={copy.auth.logout}
            aria-label={copy.auth.logout}
            onClick={logout}
          >
            <LogOut size={19} />
          </button>
        </div>
      </aside>
      <div className="workspace">
        <div className="topbar no-print">
          <span>Oficina / Administração</span>
          <span className="topbar-right">
            <span className={`connection-dot ${online ? "" : "offline"}`} />
            {online ? copy.common.online : "Sem conexão"}
          </span>
        </div>
        {!online && (
          <div className="offline-banner" role="alert">
            <WifiOff size={18} />
            {copy.common.offline}
          </div>
        )}
        <main id="main" className="main-content" tabIndex={-1}>
          <Outlet />
        </main>
        <footer className="workspace-footer no-print">
          <span>Susumu Vehicle Check</span>
          <span>Acesso restrito à sua empresa e unidade</span>
        </footer>
      </div>
    </div>
  );
}
function LinkBrand() {
  return (
    <div className="brand">
      <div className="brand-mark">
        <Truck size={25} />
      </div>
      <div>
        <strong>{copy.brand}</strong>
        <span>{copy.product}</span>
      </div>
    </div>
  );
}
