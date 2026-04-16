import { useEffect, useMemo, useState } from 'react';
import { listarCampiAtivos, listarCampiTodos } from '../../services/campiService';
import { atualizarSetor, criarSetor, importarSetoresPlanilha, listarSetoresAtivos, listarSetoresTodos } from '../../services/setoresService';
import { CampusItem } from '../../types/campi';
import { SetorItem } from '../../types/setores';

interface SetoresPageProps {
  enabled: boolean;
}

interface SetorFormState {
  id: number;
  nome: string;
  sigla: string;
  ativo: boolean;
  campusId: string;
}

export function SetoresPage({ enabled }: SetoresPageProps) {
  const [setores, setSetores] = useState<SetorItem[]>([]);
  const [campi, setCampi] = useState<CampusItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [nomeNovoSetor, setNomeNovoSetor] = useState('');
  const [siglaNovoSetor, setSiglaNovoSetor] = useState('');
  const [campusNovoSetor, setCampusNovoSetor] = useState('');
  const [podeGerir, setPodeGerir] = useState(false);
  const [modalEdicaoAberto, setModalEdicaoAberto] = useState(false);
  const [formEdicao, setFormEdicao] = useState<SetorFormState | null>(null);

  useEffect(() => {
    if (!enabled) {
      setSetores([]);
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
        const [campiLista, lista] = await Promise.all([listarCampiTodos(), listarSetoresTodos()]);
        setCampi(campiLista);
        setSetores(lista);
        setPodeGerir(true);
      } catch (error) {
        const status = (error as Error & { status?: number }).status;
        if (status === 403) {
          try {
            const [campiAtivos, ativos] = await Promise.all([listarCampiAtivos(), listarSetoresAtivos()]);
            setCampi(campiAtivos);
            setSetores(ativos);
            setPodeGerir(false);
            setInfo('Voce pode visualizar os setores, mas a gestao e exclusiva do Administrador Master.');
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
    return setores.filter((item) => `${item.nome} ${item.sigla} ${item.campusNome || ''} ${item.campusSigla || ''}`.toLowerCase().includes(termo));
  }, [setores, busca]);

  const submitNovoSetor = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!podeGerir) {
      setErro('Somente o Administrador Master pode cadastrar novos setores.');
      return;
    }

    const nome = nomeNovoSetor.trim();
    const sigla = siglaNovoSetor.trim().toUpperCase();
    const campusId = Number(campusNovoSetor);

    if (!nome || !sigla || !Number.isInteger(campusId) || campusId <= 0) {
      setErro('Informe nome, sigla e campus para cadastrar o setor.');
      return;
    }

    setSalvando(true);
    setErro(null);
    setInfo(null);
    try {
      const setor = await criarSetor({ nome, sigla, campusId });
      setSetores((atual) => [setor, ...atual.filter((item) => item.id !== setor.id)]);
      setNomeNovoSetor('');
      setSiglaNovoSetor('');
      setCampusNovoSetor('');
      setInfo('Setor cadastrado com sucesso.');
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Nao foi possivel cadastrar setor.');
    } finally {
      setSalvando(false);
    }
  };

  const abrirEdicao = (setor: SetorItem) => {
    setFormEdicao({
      id: setor.id,
      nome: setor.nome,
      sigla: setor.sigla,
      ativo: Boolean(setor.ativo),
      campusId: setor.campusId ? String(setor.campusId) : ''
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
    const campusId = Number(formEdicao.campusId);

    if (!nome || !sigla || !Number.isInteger(campusId) || campusId <= 0) {
      setErro('Informe nome, sigla e campus validos para atualizar o setor.');
      return;
    }

    setSalvando(true);
    setErro(null);
    setInfo(null);
    try {
      const atualizado = await atualizarSetor(formEdicao.id, {
        nome,
        sigla,
        ativo: formEdicao.ativo,
        campusId
      });

      setSetores((atual) => atual.map((item) => (item.id === atualizado.id ? atualizado : item)));
      setInfo('Setor atualizado com sucesso.');
      fecharEdicao();
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Nao foi possivel atualizar setor.');
    } finally {
      setSalvando(false);
    }
  };

  const handleImportarPlanilha = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = event.target.files?.[0];
    event.target.value = '';

    if (!arquivo) return;
    if (!podeGerir) {
      setErro('Somente o Administrador Master pode importar planilha de setores.');
      return;
    }

    setImportando(true);
    setErro(null);
    setInfo(null);

    try {
      const resultado = await importarSetoresPlanilha(arquivo);
      setInfo(`${resultado.mensagem} Inseridos: ${resultado.resumo.inseridos}. Atualizados: ${resultado.resumo.atualizados}.`);
      const lista = await listarSetoresTodos();
      setSetores(lista);
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Nao foi possivel importar planilha.');
    } finally {
      setImportando(false);
    }
  };

  return (
    <section className="panel">
      <div className="panel-title">
        <h2>Setores</h2>
        <span>Cadastro, atualizacao e importacao com relacionamento a campus</span>
      </div>

      {!enabled ? (
        <p className="muted">Autentique-se para visualizar e gerenciar setores.</p>
      ) : (
        <>
          <div className="setores-bloco">
            <form className="setores-form setores-form-campus" onSubmit={submitNovoSetor}>
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
              <label>
                Campus
                <select
                  value={campusNovoSetor}
                  onChange={(event) => setCampusNovoSetor(event.target.value)}
                  disabled={!podeGerir || salvando}
                >
                  <option value="">Selecione</option>
                  {campi.map((campus) => (
                    <option key={campus.id} value={campus.id}>
                      {campus.sigla} - {campus.nome}
                    </option>
                  ))}
                </select>
              </label>
              <button className="btn-mini setores-submit" type="submit" disabled={!podeGerir || salvando}>
                {salvando ? 'Cadastrando...' : 'Cadastrar setor'}
              </button>
            </form>
          </div>

          <div className="setores-bloco">
            <div className="setores-upload-row">
              <label className="setores-upload-btn">
                {importando ? 'Importando planilha...' : 'Importar planilha de setores'}
                <input
                  type="file"
                  accept=".xlsx,.csv"
                  onChange={handleImportarPlanilha}
                  disabled={!podeGerir || importando}
                />
              </label>
              <a className="setores-template-btn" href="/modelo-setores-preenchido.csv" download>
                Baixar modelo pre-preenchido
              </a>
              <span className="muted">Colunas obrigatorias: Setor Nome, Setor Sigla, Campus, Campus Sigla.</span>
            </div>
          </div>

          <div className="setores-bloco">
            <div className="setores-filtros">
              <label>
                Buscar setor
                <input
                  type="text"
                  value={busca}
                  onChange={(event) => setBusca(event.target.value)}
                  placeholder="Nome, sigla ou campus"
                />
              </label>
              <span className="muted">{setoresFiltrados.length} setor(es)</span>
            </div>
          </div>

          {erro ? <div className="error">{erro}</div> : null}
          {info ? <div className="loading-inline">{info}</div> : null}
          {loading ? <div className="loading-inline">Carregando setores...</div> : null}

          <div className="processos-tabela-wrap">
            <table className="processos-tabela setores-tabela-campus">
              <thead>
                <tr>
                  <th>Sigla</th>
                  <th>Nome</th>
                  <th>Campus</th>
                  <th>Status</th>
                  {podeGerir ? <th>Acoes</th> : null}
                </tr>
              </thead>
              <tbody>
                {setoresFiltrados.map((setor) => (
                  <tr key={setor.id}>
                    <td>{setor.sigla}</td>
                    <td>{setor.nome}</td>
                    <td>{setor.campusSigla ? `${setor.campusSigla} - ${setor.campusNome || ''}` : '-'}</td>
                    <td>
                      <span className={`status-pill ${setor.ativo ? 'status-recebido' : 'status-fim'}`}>
                        {setor.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    {podeGerir ? (
                      <td>
                        <button className="btn-mini" type="button" onClick={() => abrirEdicao(setor)}>
                          Editar
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
                {!setoresFiltrados.length ? (
                  <tr>
                    <td colSpan={podeGerir ? 5 : 4} className="muted">
                      Nenhum setor encontrado para o filtro aplicado.
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
                  <h3>Editar Setor</h3>
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
                    Campus
                    <select
                      value={formEdicao.campusId}
                      onChange={(event) => setFormEdicao((atual) => (atual ? { ...atual, campusId: event.target.value } : atual))}
                    >
                      <option value="">Selecione</option>
                      {campi.map((campus) => (
                        <option key={campus.id} value={campus.id}>
                          {campus.sigla} - {campus.nome}
                        </option>
                      ))}
                    </select>
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
