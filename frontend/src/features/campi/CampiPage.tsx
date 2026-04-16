import { useEffect, useMemo, useState } from 'react';
import { atualizarCampus, criarCampus, listarCampiAtivos, listarCampiTodos } from '../../services/campiService';
import { CampusItem } from '../../types/campi';

interface CampiPageProps {
  enabled: boolean;
}

interface CampusFormState {
  id: number;
  nome: string;
  sigla: string;
  ativo: boolean;
}

export function CampiPage({ enabled }: CampiPageProps) {
  const [campi, setCampi] = useState<CampusItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [nomeNovoCampus, setNomeNovoCampus] = useState('');
  const [siglaNovoCampus, setSiglaNovoCampus] = useState('');
  const [podeGerir, setPodeGerir] = useState(false);
  const [modalEdicaoAberto, setModalEdicaoAberto] = useState(false);
  const [formEdicao, setFormEdicao] = useState<CampusFormState | null>(null);

  useEffect(() => {
    if (!enabled) {
      setCampi([]);
      setErro(null);
      setInfo(null);
      setPodeGerir(false);
      return;
    }

    const carregar = async () => {
      setLoading(true);
      setErro(null);
      setInfo(null);
      try {
        const lista = await listarCampiTodos();
        setCampi(lista);
        setPodeGerir(true);
      } catch (error) {
        const status = (error as Error & { status?: number }).status;
        if (status === 403) {
          try {
            const ativos = await listarCampiAtivos();
            setCampi(ativos);
            setPodeGerir(false);
            setInfo('Voce pode visualizar os campi, mas a gestao e exclusiva do Administrador Master.');
          } catch (erroAtivos) {
            setErro(erroAtivos instanceof Error ? erroAtivos.message : 'Nao foi possivel carregar os campi.');
          }
        } else {
          setErro(error instanceof Error ? error.message : 'Nao foi possivel carregar os campi.');
        }
      } finally {
        setLoading(false);
      }
    };

    void carregar();
  }, [enabled]);

  const campiFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return campi;
    return campi.filter((item) => `${item.nome} ${item.sigla}`.toLowerCase().includes(termo));
  }, [campi, busca]);

  const submitNovoCampus = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!podeGerir) {
      setErro('Somente o Administrador Master pode cadastrar campi.');
      return;
    }

    const nome = nomeNovoCampus.trim();
    const sigla = siglaNovoCampus.trim().toUpperCase();

    if (!nome || !sigla) {
      setErro('Informe nome e sigla para cadastrar o campus.');
      return;
    }

    setSalvando(true);
    setErro(null);
    setInfo(null);
    try {
      const campus = await criarCampus({ nome, sigla });
      setCampi((atual) => [campus, ...atual.filter((item) => item.id !== campus.id)]);
      setNomeNovoCampus('');
      setSiglaNovoCampus('');
      setInfo('Campus cadastrado com sucesso.');
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Nao foi possivel cadastrar campus.');
    } finally {
      setSalvando(false);
    }
  };

  const abrirEdicao = (campus: CampusItem) => {
    setFormEdicao({
      id: campus.id,
      nome: campus.nome,
      sigla: campus.sigla,
      ativo: Boolean(campus.ativo)
    });
    setModalEdicaoAberto(true);
  };

  const fecharEdicao = () => {
    setModalEdicaoAberto(false);
    setFormEdicao(null);
  };

  const salvarEdicao = async () => {
    if (!formEdicao) return;

    const nome = formEdicao.nome.trim();
    const sigla = formEdicao.sigla.trim().toUpperCase();
    if (!nome || !sigla) {
      setErro('Informe nome e sigla validos para atualizar o campus.');
      return;
    }

    setSalvando(true);
    setErro(null);
    setInfo(null);
    try {
      const atualizado = await atualizarCampus(formEdicao.id, {
        nome,
        sigla,
        ativo: formEdicao.ativo
      });
      setCampi((atual) => atual.map((item) => (item.id === atualizado.id ? atualizado : item)));
      setInfo('Campus atualizado com sucesso.');
      fecharEdicao();
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Nao foi possivel atualizar campus.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <section className="panel">
      <div className="panel-title">
        <h2>Campi</h2>
        <span>Cadastro e atualizacao de campi institucionais</span>
      </div>

      {!enabled ? (
        <p className="muted">Autentique-se para visualizar e gerenciar campi.</p>
      ) : (
        <>
          <form className="setores-form" onSubmit={submitNovoCampus}>
            <label>
              Nome do campus
              <input
                type="text"
                value={nomeNovoCampus}
                onChange={(event) => setNomeNovoCampus(event.target.value)}
                placeholder="Ex.: Campus Dourados"
                disabled={!podeGerir || salvando}
              />
            </label>
            <label>
              Sigla
              <input
                type="text"
                value={siglaNovoCampus}
                onChange={(event) => setSiglaNovoCampus(event.target.value.toUpperCase())}
                placeholder="Ex.: DR"
                disabled={!podeGerir || salvando}
              />
            </label>
            <button className="btn-mini setores-submit" type="submit" disabled={!podeGerir || salvando}>
              {salvando ? 'Cadastrando...' : 'Cadastrar campus'}
            </button>
          </form>

          <div className="setores-filtros">
            <label>
              Buscar campus
              <input
                type="text"
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Nome ou sigla"
              />
            </label>
            <span className="muted">{campiFiltrados.length} campus</span>
          </div>

          {erro ? <div className="error">{erro}</div> : null}
          {info ? <div className="loading-inline">{info}</div> : null}
          {loading ? <div className="loading-inline">Carregando campi...</div> : null}

          <div className="processos-tabela-wrap">
            <table className="processos-tabela">
              <thead>
                <tr>
                  <th>Sigla</th>
                  <th>Nome</th>
                  <th>Status</th>
                  {podeGerir ? <th>Acoes</th> : null}
                </tr>
              </thead>
              <tbody>
                {campiFiltrados.map((campus) => (
                  <tr key={campus.id}>
                    <td>{campus.sigla}</td>
                    <td>{campus.nome}</td>
                    <td>
                      <span className={`status-pill ${campus.ativo ? 'status-recebido' : 'status-fim'}`}>
                        {campus.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    {podeGerir ? (
                      <td>
                        <button className="btn-mini" type="button" onClick={() => abrirEdicao(campus)}>
                          Editar
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
                {!campiFiltrados.length ? (
                  <tr>
                    <td colSpan={podeGerir ? 4 : 3} className="muted">
                      Nenhum campus encontrado.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {modalEdicaoAberto && formEdicao ? (
            <div className="modal-overlay" role="dialog" aria-modal="true">
              <div className="modal-card modal-card-compact">
                <div className="panel-title">
                  <h3>Editar Campus</h3>
                  <button className="btn-mini" type="button" onClick={fecharEdicao}>
                    Fechar
                  </button>
                </div>
                <div className="modal-form-grid">
                  <label>
                    Nome
                    <input
                      type="text"
                      value={formEdicao.nome}
                      onChange={(event) => setFormEdicao((atual) => (atual ? { ...atual, nome: event.target.value } : atual))}
                    />
                  </label>
                  <label>
                    Sigla
                    <input
                      type="text"
                      value={formEdicao.sigla}
                      onChange={(event) => setFormEdicao((atual) => (atual ? { ...atual, sigla: event.target.value.toUpperCase() } : atual))}
                    />
                  </label>
                  <label>
                    Ativo
                    <select
                      value={formEdicao.ativo ? 'true' : 'false'}
                      onChange={(event) => setFormEdicao((atual) => (atual ? { ...atual, ativo: event.target.value === 'true' } : atual))}
                    >
                      <option value="true">Ativo</option>
                      <option value="false">Inativo</option>
                    </select>
                  </label>
                </div>
                <div className="modal-actions">
                  <button className="btn-mini" type="button" onClick={fecharEdicao}>
                    Cancelar
                  </button>
                  <button className="btn-mini" type="button" onClick={salvarEdicao} disabled={salvando}>
                    {salvando ? 'Salvando...' : 'Salvar alteracoes'}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

