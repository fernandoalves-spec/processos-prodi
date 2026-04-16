import { useEffect, useMemo, useState } from 'react';
import { listarSetoresAtivos } from '../../services/setoresService';
import { atualizarProcesso, distribuirProcessoInternamente, listarProcessos } from '../../services/processosService';
import { ProcessoItem } from '../../types/processos';
import { SetorItem } from '../../types/setores';

interface ProcessosPageProps {
  enabled: boolean;
  canDistribuirInternamente: boolean;
}

type SortField = 'protocolo' | 'assunto' | 'status';
type SortDirection = 'asc' | 'desc';

interface ProcessoFormState {
  id: number;
  status: string;
  precisaResposta: string;
  dataRecebimento: string;
  protocolo: string;
  link: string;
  origem: string;
  destino: string;
  setorDestinoId: string;
  prazoDiasUteis: string;
  assunto: string;
  observacao: string;
}

const STATUS_ENCAMINHADO_INTERNO = 'Encaminhado Internamente';

function statusClass(status: string) {
  const s = String(status || '').toLowerCase();
  if (s.includes('finaliz')) return 'status-pill status-fim';
  if (s.includes('analise')) return 'status-pill status-analise';
  if (s.includes('encaminh')) return 'status-pill status-caminho';
  return 'status-pill status-recebido';
}

function labelSetorDestino(processo: ProcessoItem) {
  if (!processo.setorDestinoId) return '-';
  const sigla = processo.setorDestinoSigla || '';
  const nome = processo.setorDestinoNome || '';
  if (sigla && nome) return `${sigla} - ${nome}`;
  return nome || sigla || `Setor #${processo.setorDestinoId}`;
}

export function ProcessosPage({ enabled, canDistribuirInternamente }: ProcessosPageProps) {
  const [processos, setProcessos] = useState<ProcessoItem[]>([]);
  const [setores, setSetores] = useState<SetorItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingSetores, setLoadingSetores] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState('');
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina, setItensPorPagina] = useState(10);
  const [sortField, setSortField] = useState<SortField>('protocolo');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [modalAberto, setModalAberto] = useState(false);
  const [salvandoModal, setSalvandoModal] = useState(false);
  const [distribuindoInterno, setDistribuindoInterno] = useState(false);
  const [form, setForm] = useState<ProcessoFormState | null>(null);

  useEffect(() => {
    if (!enabled) {
      setProcessos([]);
      setSetores([]);
      setErro(null);
      return;
    }

    setLoading(true);
    setErro(null);
    listarProcessos()
      .then((dados) => setProcessos(dados))
      .catch(() => setErro('Nao foi possivel carregar a lista de processos.'))
      .finally(() => setLoading(false));

    setLoadingSetores(true);
    listarSetoresAtivos()
      .then((dados) => setSetores(dados))
      .catch(() => setErro('Nao foi possivel carregar os setores internos.'))
      .finally(() => setLoadingSetores(false));
  }, [enabled]);

  const statusDisponiveis = useMemo(() => [...new Set(processos.map((p) => p.status))], [processos]);

  const processosFiltradosOrdenados = useMemo(() => {
    const filtrados = processos.filter((item) => {
      const termo = busca.trim().toLowerCase();
      if (termo) {
        const alvo = `${item.protocolo} ${item.assunto} ${item.origem || ''} ${item.destino || ''} ${item.setorDestinoNome || ''} ${item.setorDestinoSigla || ''}`.toLowerCase();
        if (!alvo.includes(termo)) return false;
      }
      if (status && item.status !== status) return false;
      return true;
    });

    return [...filtrados].sort((a, b) => {
      const valueA =
        sortField === 'protocolo'
          ? String(a.protocolo || '').toLowerCase()
          : sortField === 'assunto'
            ? String(a.assunto || '').toLowerCase()
            : String(a.status || '').toLowerCase();

      const valueB =
        sortField === 'protocolo'
          ? String(b.protocolo || '').toLowerCase()
          : sortField === 'assunto'
            ? String(b.assunto || '').toLowerCase()
            : String(b.status || '').toLowerCase();

      if (valueA < valueB) return sortDirection === 'asc' ? -1 : 1;
      if (valueA > valueB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [processos, busca, status, sortField, sortDirection]);

  const totalPaginas = Math.max(1, Math.ceil(processosFiltradosOrdenados.length / itensPorPagina));
  const paginaCorrigida = Math.min(paginaAtual, totalPaginas);

  const processosPaginados = useMemo(() => {
    const inicio = (paginaCorrigida - 1) * itensPorPagina;
    const fim = inicio + itensPorPagina;
    return processosFiltradosOrdenados.slice(inicio, fim);
  }, [processosFiltradosOrdenados, paginaCorrigida, itensPorPagina]);

  useEffect(() => {
    setPaginaAtual(1);
  }, [busca, status, sortField, sortDirection, itensPorPagina]);

  useEffect(() => {
    if (paginaAtual > totalPaginas) {
      setPaginaAtual(totalPaginas);
    }
  }, [paginaAtual, totalPaginas]);

  const alterarOrdenacao = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortField(field);
    setSortDirection('asc');
  };

  const labelOrdenacao = (field: SortField) => {
    if (sortField !== field) return '^^';
    return sortDirection === 'asc' ? '^' : 'v';
  };

  const irPaginaAnterior = () => setPaginaAtual((prev) => Math.max(1, prev - 1));
  const irPaginaSeguinte = () => setPaginaAtual((prev) => Math.min(totalPaginas, prev + 1));

  const abrirModal = (processo: ProcessoItem) => {
    setForm({
      id: processo.id,
      status: processo.status || 'Recebido',
      precisaResposta: processo.precisaResposta || 'Nao',
      dataRecebimento: processo.dataRecebimento ? String(processo.dataRecebimento).slice(0, 10) : '',
      protocolo: processo.protocolo || '',
      link: processo.link || '',
      origem: processo.origem || '',
      destino: processo.destino || '',
      setorDestinoId: processo.setorDestinoId ? String(processo.setorDestinoId) : '',
      prazoDiasUteis: processo.prazoDiasUteis === null || processo.prazoDiasUteis === undefined ? '' : String(processo.prazoDiasUteis),
      assunto: processo.assunto || '',
      observacao: processo.observacao || ''
    });
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setForm(null);
  };

  const updateForm = <K extends keyof ProcessoFormState>(campo: K, valor: ProcessoFormState[K]) => {
    setForm((atual) => (atual ? { ...atual, [campo]: valor } : atual));
  };

  const aplicarMovimentacao = (proximoStatus: string) => {
    setForm((atual) => (atual ? { ...atual, status: proximoStatus } : atual));
  };

  const setorSelecionado = form?.setorDestinoId
    ? setores.find((item) => item.id === Number(form.setorDestinoId))
    : null;

  const salvarModal = async () => {
    if (!form) return;

    const prazoNumerico = form.prazoDiasUteis === '' ? null : Number(form.prazoDiasUteis);
    if (prazoNumerico !== null && !Number.isFinite(prazoNumerico)) {
      setErro('Prazo em dias uteis invalido.');
      return;
    }

    let destinoLegado = form.destino.trim();
    if (form.status === STATUS_ENCAMINHADO_INTERNO && setorSelecionado) {
      destinoLegado = `${setorSelecionado.sigla} - ${setorSelecionado.nome}`;
    }

    setSalvandoModal(true);
    setErro(null);
    try {
      const atualizadoBase = await atualizarProcesso(form.id, {
        status: form.status,
        precisaResposta: form.precisaResposta,
        dataRecebimento: form.dataRecebimento || null,
        protocolo: form.protocolo,
        link: form.link || null,
        origem: form.origem || null,
        destino: destinoLegado || null,
        prazoDiasUteis: prazoNumerico,
        assunto: form.assunto,
        observacao: form.observacao || null
      });

      let atualizadoFinal = atualizadoBase;
      if (form.status === STATUS_ENCAMINHADO_INTERNO && canDistribuirInternamente && form.setorDestinoId) {
        atualizadoFinal = await distribuirProcessoInternamente(form.id, {
          setorDestinoId: Number(form.setorDestinoId),
          status: STATUS_ENCAMINHADO_INTERNO
        });
      }

      setProcessos((atual) => atual.map((item) => (item.id === atualizadoFinal.id ? atualizadoFinal : item)));
      fecharModal();
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Nao foi possivel atualizar o processo.');
    } finally {
      setSalvandoModal(false);
    }
  };

  const distribuirInternamente = async () => {
    if (!form) return;

    if (!canDistribuirInternamente) {
      setErro('Somente Administrador Master e Gestor PRODI podem distribuir internamente.');
      return;
    }

    if (!form.setorDestinoId) {
      setErro('Selecione o setor interno de destino para distribuir.');
      return;
    }

    setDistribuindoInterno(true);
    setErro(null);
    try {
      const atualizado = await distribuirProcessoInternamente(form.id, {
        setorDestinoId: Number(form.setorDestinoId),
        status: STATUS_ENCAMINHADO_INTERNO
      });
      setProcessos((atual) => atual.map((item) => (item.id === atualizado.id ? atualizado : item)));
      fecharModal();
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Nao foi possivel distribuir internamente.');
    } finally {
      setDistribuindoInterno(false);
    }
  };

  return (
    <section className="panel">
      <div className="panel-title">
        <h2>Gestao de Processos</h2>
        <span>Lista detalhada e movimentacoes por processo</span>
      </div>

      {!enabled ? (
        <p className="muted">Autentique-se para visualizar os processos.</p>
      ) : (
        <>
          <div className="processos-filtros">
            <label>
              Buscar
              <input
                type="text"
                placeholder="Protocolo, assunto, origem, destino ou setor"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </label>
            <label>
              Status
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">Todos</option>
                {statusDisponiveis.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Itens por pagina
              <select value={itensPorPagina} onChange={(e) => setItensPorPagina(Number(e.target.value))}>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </label>
          </div>

          {!canDistribuirInternamente ? (
            <div className="loading-inline">Distribuicao interna restrita a ADMIN_MASTER e GESTOR_PRODI.</div>
          ) : null}

          {erro ? <div className="error">{erro}</div> : null}
          {loading ? <div className="loading-inline">Carregando processos...</div> : null}

          <div className="processos-layout">
            <div className="processos-tabela-wrap">
              <table className="processos-tabela processos-distribuicao-tabela">
                <thead>
                  <tr>
                    <th>
                      <button className="th-sort" type="button" onClick={() => alterarOrdenacao('protocolo')}>
                        Protocolo {labelOrdenacao('protocolo')}
                      </button>
                    </th>
                    <th>
                      <button className="th-sort" type="button" onClick={() => alterarOrdenacao('assunto')}>
                        Assunto {labelOrdenacao('assunto')}
                      </button>
                    </th>
                    <th>
                      <button className="th-sort" type="button" onClick={() => alterarOrdenacao('status')}>
                        Status {labelOrdenacao('status')}
                      </button>
                    </th>
                    <th>Destino Interno</th>
                    <th>Fila Interna</th>
                    <th>Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {processosPaginados.map((item) => (
                    <tr key={item.id}>
                      <td>{item.protocolo}</td>
                      <td>{item.assunto}</td>
                      <td>
                        <span className={statusClass(item.status)}>{item.status}</span>
                      </td>
                      <td>{labelSetorDestino(item)}</td>
                      <td>
                        <span className={`status-pill ${item.filaInternaPendente ? 'status-analise' : 'status-fim'}`}>
                          {item.filaInternaPendente ? 'Pendente' : 'Sem pendencia'}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn-mini"
                          type="button"
                          aria-label={`Visualizar processo ${item.protocolo}`}
                          onClick={() => abrirModal(item)}
                        >
                          Ver
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!processosPaginados.length ? (
                    <tr>
                      <td colSpan={6} className="muted">
                        Nenhum processo encontrado para os filtros aplicados.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <div className="paginacao">
              <span>
                {processosFiltradosOrdenados.length} processo(s) - pagina {paginaCorrigida} de {totalPaginas}
              </span>
              <div className="paginacao-botoes">
                <button className="btn-mini" type="button" onClick={irPaginaAnterior} disabled={paginaCorrigida <= 1}>
                  Anterior
                </button>
                <button className="btn-mini" type="button" onClick={irPaginaSeguinte} disabled={paginaCorrigida >= totalPaginas}>
                  Proxima
                </button>
              </div>
            </div>
          </div>

          {modalAberto && form ? (
            <div className="modal-overlay" role="dialog" aria-modal="true">
              <div className="modal-card">
                <div className="panel-title">
                  <h3>Processo {form.protocolo}</h3>
                  <button className="btn-mini" type="button" onClick={fecharModal}>
                    Fechar
                  </button>
                </div>

                <div className="processo-link-box">
                  <strong>Link do processo</strong>
                  {form.link ? (
                    <a href={form.link} target="_blank" rel="noopener noreferrer" className="processo-link-cta">
                      Abrir processo
                    </a>
                  ) : (
                    <span className="muted">Sem link cadastrado para este processo.</span>
                  )}
                </div>

                <div className="movimentacoes">
                  <strong>Movimentacoes possiveis</strong>
                  <div className="movimentacoes-botoes">
                    <button className="btn-mini" type="button" onClick={() => aplicarMovimentacao('Recebido')}>Recebido</button>
                    <button className="btn-mini" type="button" onClick={() => aplicarMovimentacao(STATUS_ENCAMINHADO_INTERNO)}>Encaminhar Interno</button>
                    <button className="btn-mini" type="button" onClick={() => aplicarMovimentacao('Encaminhados Externamente')}>Encaminhar Externo</button>
                    <button className="btn-mini" type="button" onClick={() => aplicarMovimentacao('Em analise')}>Em analise</button>
                    <button className="btn-mini" type="button" onClick={() => aplicarMovimentacao('Finalizado')}>Finalizar</button>
                  </div>
                </div>

                {form.status === STATUS_ENCAMINHADO_INTERNO ? (
                  <div className="encaminhamento-interno-box">
                    <strong>Distribuicao interna por setor</strong>
                    <p>Selecione o setor interno de destino para registrar na fila de distribuicao.</p>
                    <div className="encaminhamento-interno-grid">
                      <label>
                        Setor interno de destino
                        <select
                          value={form.setorDestinoId}
                          onChange={(e) => updateForm('setorDestinoId', e.target.value)}
                          disabled={loadingSetores}
                        >
                          <option value="">Selecione um setor</option>
                          {setores.map((setor) => (
                            <option key={setor.id} value={setor.id}>
                              {setor.sigla} - {setor.nome}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Status da fila
                        <input type="text" value={form.setorDestinoId ? 'Pendente no setor interno' : ''} readOnly />
                      </label>
                    </div>
                    <div className="distribuicao-inline-actions">
                      <button
                        className="btn-mini distribuicao-btn"
                        type="button"
                        onClick={distribuirInternamente}
                        disabled={!canDistribuirInternamente || distribuindoInterno || !form.setorDestinoId}
                      >
                        {distribuindoInterno ? 'Distribuindo...' : 'Distribuir internamente'}
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="modal-form-grid">
                  <label>
                    Status
                    <select value={form.status} onChange={(e) => updateForm('status', e.target.value)}>
                      <option value="Recebido">Recebido</option>
                      <option value="Encaminhados Externamente">Encaminhados Externamente</option>
                      <option value={STATUS_ENCAMINHADO_INTERNO}>Encaminhado Internamente</option>
                      <option value="Finalizado">Finalizado</option>
                      <option value="Em analise">Em analise</option>
                    </select>
                  </label>
                  <label>
                    Precisa resposta
                    <select value={form.precisaResposta} onChange={(e) => updateForm('precisaResposta', e.target.value)}>
                      <option value="Nao">Nao</option>
                      <option value="Sim">Sim</option>
                    </select>
                  </label>
                  <label>
                    Data recebimento
                    <input type="date" value={form.dataRecebimento} onChange={(e) => updateForm('dataRecebimento', e.target.value)} />
                  </label>
                  <label>
                    Protocolo
                    <input type="text" value={form.protocolo} onChange={(e) => updateForm('protocolo', e.target.value)} />
                  </label>
                  <label>
                    Origem
                    <input type="text" value={form.origem} onChange={(e) => updateForm('origem', e.target.value)} />
                  </label>
                  {form.status !== STATUS_ENCAMINHADO_INTERNO ? (
                    <label>
                      Destino (legado)
                      <input type="text" value={form.destino} onChange={(e) => updateForm('destino', e.target.value)} />
                    </label>
                  ) : null}
                  {form.status !== STATUS_ENCAMINHADO_INTERNO ? (
                    <label>
                      Prazo dias uteis
                      <input
                        type="number"
                        min={0}
                        value={form.prazoDiasUteis}
                        onChange={(e) => updateForm('prazoDiasUteis', e.target.value)}
                      />
                    </label>
                  ) : null}
                  <label>
                    Link
                    <input type="text" value={form.link} onChange={(e) => updateForm('link', e.target.value)} />
                  </label>
                  <label className="field-span-2">
                    Assunto
                    <input type="text" value={form.assunto} onChange={(e) => updateForm('assunto', e.target.value)} />
                  </label>
                  <label className="field-span-2">
                    Observacao
                    <textarea rows={3} value={form.observacao} onChange={(e) => updateForm('observacao', e.target.value)} />
                  </label>
                </div>

                <div className="modal-actions">
                  <button className="btn-mini" type="button" onClick={fecharModal}>
                    Cancelar
                  </button>
                  <button className="btn-mini" type="button" onClick={salvarModal} disabled={salvandoModal}>
                    {salvandoModal ? 'Salvando...' : 'Salvar alteracoes'}
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
