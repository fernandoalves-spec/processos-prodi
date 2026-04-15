import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';

interface AppLayoutProps {
  children: ReactNode;
  autenticado: boolean;
  usuarioLabel: string;
  onLogout: () => void;
}

export function AppLayout({ children, autenticado, usuarioLabel, onLogout }: AppLayoutProps) {
  return (
    <div>
      <div className="topbar" />
      <header className="header">
        <div className="header-wrap">
          <div className="brand">
            <h1>Dashboard de Processos</h1>
            <p>Pró-Reitoria de Desenvolvimento Institucional</p>
          </div>
          <div className="header-actions">
            <span className="chip">{usuarioLabel}</span>
            {!autenticado ? (
              <a className="btn-link" href="/auth/google">
                Entrar com Google
              </a>
            ) : (
              <button className="btn-link" type="button" onClick={onLogout}>
                Sair
              </button>
            )}
          </div>
        </div>
        <nav className="nav">
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/processos">Processos</NavLink>
          <NavLink to="/setores">Setores</NavLink>
          <NavLink to="/usuarios">Usuários</NavLink>
        </nav>
      </header>
      <main className="main">{children}</main>
      <footer className="footer">
        <span>PRODI · IFMS</span>
        <Link to="/dashboard">Início</Link>
      </footer>
    </div>
  );
}
