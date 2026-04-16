import { useEffect, useMemo, useState } from 'react';
import { criarSetor, listarSetoresAtivos, listarSetoresTodos } from '../../services/setoresService';
import { SetorItem } from '../../types/setores';

interface SetoresPageProps {
  enabled: boolean;
}

export function SetoresPage({ enabled }: SetoresPageProps) {
  const [setores, setSetores] = useState<SetorItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [nomeNovoSetor, setNomeNovoSetor] = useState('');
  const [siglaNovoSetor, setSiglaNovoSetor] = useState('');
  const [podeGerir, setPodeGerir] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setSetores([]);
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
        const lista = await listarSetoresTodos();
        setSetores(lista);
        setPodeGerir(true);
      } catch (error) {
        const status = (error as Error & { status?: number }).status;
        if (status === 403) {
          try {
            const ativos = await listarSetoresAtivos();
            setSetores(ativos);
            setPodeGerir(false);
            setInfo('Voce pode visualizar os setores, mas o cadastro manual e exclusivo do Administrador Master.');
          } catch (erroAtivos) {
            setErro(erroAtivos instanceof Error ? erroAtivos.message : 'Nao foi possivel carregar os setores.');
          }
        } else {
          setErro(error instanceof Error ? error.message : 'Nao foi possivel carregar os setores.');
        }
      } finally {
        setLoading(false);
      }
    };

    void carregar();
  }, [enabled]);

  const setoresFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return setores;
    return setores.filter((item) => `${item.nome} ${item.sigla}`.toLowerCase().includes(termo));
  }, [setores, busca]);

  const submitNovoSetor = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!podeGerir) {
      setErro('Somente o Administrador Master pode cadastrar novos setores.');
      return;
    }

    const nome = nomeNovoSetor.trim();
    const sigla = siglaNovoSetor.trim().toUpperCase();

    if (!nome || !sigla) {
      setErro('Informe nome e sigla para cadastrar o setor.');
      return;
    }

    setSalvando(true);
    setErro(null);
    setInfo(null);
    try {
      const setor = await criarSetor({ nome, sigla });
      setSetores((atual) => [setor, ...atual.filter((item) => item.id !== setor.id)]);
      setNomeNovoSetor('');
      setSiglaNovoSetor('');
      setInfo('Setor cadastrado com sucesso.');
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Nao foi possivel cadastrar setor.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <section className="panel">
      <div className="panel-title">
        <h2>Setores</h2>
        <span>Cadastro e consulta de setores institucionais</span>
      </div>

      {!enabled ? (
        <p className="muted">Autentique-se para visualizar e cadastrar setores.</p>
      ) : (
        <>
          <form className="setores-form" onSubmit={submitNovoSetor}>
            <label>
              Nome do setor
              <input
                type="text"
                value={nomeNovoSetor}
                onChange={(event) => setNomeNovoSetor(event.target.value)}
                placeholder="Ex.: Diretoria de Gestao de Pessoas"
                disabled={!podeGerir || salvando}
              />
            </label>
            <label>
              Sigla
              <input
                type="text"
                value={siglaNovoSetor}
                onChange={(event) => setSiglaNovoSetor(event.target.value.toUpperCase())}
                placeholder="Ex.: DIGEP"
                disabled={!podeGerir || salvando}
              />
            </label>
            <button className="btn-mini setores-submit" type="submit" disabled={!podeGerir || salvando}>
              {salvando ? 'Cadastrando...' : 'Cadastrar setor'}
            </button>
          </form>

          <div className="setores-filtros">
            <label>
              Buscar setor
              <input
                type="text"
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Nome ou sigla"
              />
            </label>
            <span className="muted">{setoresFiltrados.length} setor(es)</span>
          </div>

          {erro ? <div className="error">{erro}</div> : null}
          {info ? <div className="loading-inline">{info}</div> : null}
          {loading ? <div className="loading-inline">Carregando setores...</div> : null}

          <div className="processos-tabela-wrap">
            <table className="processos-tabela setores-tabela">
              <thead>
                <tr>
                  <th>Sigla</th>
                  <th>Nome</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {setoresFiltrados.map((setor) => (
                  <tr key={setor.id}>
                    <td>{setor.sigla}</td>
                    <td>{setor.nome}</td>
                    <td>
                      <span className={`status-pill ${setor.ativo ? 'status-recebido' : 'status-fim'}`}>
                        {setor.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                  </tr>
                ))}
                {!setoresFiltrados.length ? (
                  <tr>
                    <td colSpan={3} className="muted">
                      Nenhum setor encontrado para o filtro aplicado.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

