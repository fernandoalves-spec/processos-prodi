import { useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { PlaceholderPage } from './components/PlaceholderPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { GutPage } from './features/gut/GutPage';
import { ProcessosPage } from './features/processos/ProcessosPage';
import { SetoresPage } from './features/setores/SetoresPage';
import { getSessaoUsuario, logout } from './services/authService';

export function App() {
  const [autenticado, setAutenticado] = useState(false);
  const [usuarioLabel, setUsuarioLabel] = useState('Nao autenticado');
  const [perfilUsuario, setPerfilUsuario] = useState<string | null>(null);

  useEffect(() => {
    getSessaoUsuario()
      .then((sessao) => {
        setAutenticado(Boolean(sessao.autenticado));
        if (sessao.autenticado && sessao.usuario) {
          setUsuarioLabel(`${sessao.usuario.nome} (${sessao.usuario.perfilNome})`);
          setPerfilUsuario(sessao.usuario.perfil);
          return;
        }
        setUsuarioLabel('Nao autenticado');
        setPerfilUsuario(null);
      })
      .catch(() => {
        setAutenticado(false);
        setUsuarioLabel('Nao autenticado');
        setPerfilUsuario(null);
      });
  }, []);

  const handleLogout = useMemo(
    () => async () => {
      await logout();
      window.location.reload();
    },
    []
  );

  return (
    <AppLayout autenticado={autenticado} usuarioLabel={usuarioLabel} onLogout={handleLogout}>
      {!autenticado ? (
        <section className="panel">
          <div className="panel-title">
            <h2>Acesso ao Dashboard</h2>
          </div>
          <p>Voce pode visualizar a interface, mas para consumir dados reais e necessario autenticar.</p>
          <a className="btn-link inline-btn" href="/auth/google">
            Entrar com Google
          </a>
        </section>
      ) : null}

      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage enabled={autenticado} />} />
        <Route
          path="/processos"
          element={
            <ProcessosPage
              enabled={autenticado}
              canDistribuirInternamente={perfilUsuario === 'ADMIN_MASTER' || perfilUsuario === 'GESTOR_PRODI'}
            />
          }
        />
        <Route path="/gut" element={<GutPage enabled={autenticado} isAdminMaster={perfilUsuario === 'ADMIN_MASTER'} />} />
        <Route path="/setores" element={<SetoresPage enabled={autenticado} />} />
        <Route
          path="/usuarios"
          element={<PlaceholderPage titulo="Usuarios" descricao="Area para acompanhamento de desempenho por responsavel e unidade." />}
        />
      </Routes>
    </AppLayout>
  );
}
