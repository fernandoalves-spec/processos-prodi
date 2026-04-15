import { useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { PlaceholderPage } from './components/PlaceholderPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { getSessaoUsuario, logout } from './services/authService';

export function App() {
  const [autenticado, setAutenticado] = useState(false);
  const [usuarioLabel, setUsuarioLabel] = useState('Não autenticado');

  useEffect(() => {
    getSessaoUsuario()
      .then((sessao) => {
        setAutenticado(Boolean(sessao.autenticado));
        if (sessao.autenticado && sessao.usuario) {
          setUsuarioLabel(`${sessao.usuario.nome} (${sessao.usuario.perfilNome})`);
          return;
        }
        setUsuarioLabel('Não autenticado');
      })
      .catch(() => {
        setAutenticado(false);
        setUsuarioLabel('Não autenticado');
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
          <p>Você pode visualizar a interface, mas para consumir dados reais é necessário autenticar.</p>
          <a className="btn-link inline-btn" href="/auth/google">
            Entrar com Google
          </a>
        </section>
      ) : null}

      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route
          path="/processos"
          element={<PlaceholderPage titulo="Gestão de Processos" descricao="Área para lista detalhada e tramitação por processo." />}
        />
        <Route
          path="/setores"
          element={<PlaceholderPage titulo="Setores" descricao="Área para indicadores de desempenho e pendências por setor." />}
        />
        <Route
          path="/usuarios"
          element={<PlaceholderPage titulo="Usuários" descricao="Área para acompanhamento de desempenho por responsável e unidade." />}
        />
      </Routes>
    </AppLayout>
  );
}
