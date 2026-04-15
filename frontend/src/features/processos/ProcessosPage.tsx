import { useEffect, useMemo, useState } from 'react';
import { atualizarProcesso, listarProcessos } from '../../services/processosService';
import { ProcessoItem } from '../../types/processos';

interface ProcessosPageProps {
  enabled: boolean;
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
  prazoDiasUteis: string;
  assunto: string;
  observacao: string;
}

function statusClass(status: string) {
  const s = String(status || '').toLowerCase();
  if (s.includes('finaliz')) return 'status-pill status-fim';
  if (s.includes('analise')) return 'status-pill status-analise';
  if (s.includes('encaminh')) return 'status-pill status-caminho';
  return 'status-pill status-recebido';
}

export function ProcessosPage({ enabled }: ProcessosPageProps) {
  const [processos, setProcessos] = useState<ProcessoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState('');
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina, setItensPorPagina] = useState(10);
  const [sortField, setSortField] = useState<SortField>('protocolo');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [modalAberto, setModalAberto] = useState(false);
  const [salvandoModal, setSalvandoModal] = useState(false);
  const [form, setForm] = useState<ProcessoFormState | null>(null);

  useEffect(() => {
    if (!enabled) {
      setProcessos([]);
      setErro(null);
      return;
    }

    setLoading(true);
    setErro(null);
    listarProcessos()
      .then((dados) => setProcessos(dados))
      .catch(() => setErro('Nao foi possivel carregar a lista de processos.'))
      .finally(() => setLoading(false));
  }, [enabled]);

  const statusDisponiveis = useMemo(() => [...new Set(processos.map((p) => p.status))], [processos]);

  const processosFiltradosOrdenados = useMemo(() => {
    const filtrados = processos.filter((item) => {
      const termo = busca.trim().toLowerCase();
      if (termo) {
        const alvo = `${item.protocolo} ${item.assunto} ${item.origem || ''} ${item.destino || ''}`.toLowerCase();
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

  const salvarModal = async () => {
    if (!form) return;
    setSalvandoModal(true);
    setErro(null);
    try {
      const atualizado = await atualizarProcesso(form.id, {
        status: form.status,
        precisaResposta: form.precisaResposta,
        dataRecebimento: form.dataRecebimento || null,
        protocolo: form.protocolo,
        link: form.link || null,
        origem: form.origem || null,
        destino: form.destino || null,
        prazoDiasUteis: form.prazoDiasUteis === '' ? null : Number(form.prazoDiasUteis),
        assunto: form.assunto,
        observacao: form.observacao || null
      });
      setProcessos((atual) => atual.map((item) => (item.id === atualizado.id ? atualizado : item)));
      fecharModal();
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Nao foi possivel atualizar o processo.');
    } finally {
      setSalvandoModal(false);
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
                placeholder="Protocolo, assunto, origem ou destino"
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

          {erro ? <div className="error">{erro}</div> : null}
          {loading ? <div className="loading-inline">Carregando processos...</div> : null}

          <div className="processos-layout">
            <div className="processos-tabela-wrap">
              <table className="processos-tabela">
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
                      <td>
                        <button
                          className="btn-mini icon-eye"
                          type="button"
                          aria-label={`Visualizar processo ${item.protocolo}`}
                          onClick={() => abrirModal(item)}
                        >
                          👁
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!processosPaginados.length ? (
                    <tr>
                      <td colSpan={4} className="muted">
                        Nenhum processo encontrado para os filtros aplicados.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <div className="paginacao">
              <span>
                {processosFiltradosOrdenados.length} processo(s) · pagina {paginaCorrigida} de {totalPaginas}
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

                <div className="movimentacoes">
                  <strong>Movimentacoes possiveis</strong>
                  <div className="movimentacoes-botoes">
                    <button className="btn-mini" type="button" onClick={() => aplicarMovimentacao('Recebido')}>Recebido</button>
                    <button className="btn-mini" type="button" onClick={() => aplicarMovimentacao('Encaminhado Internamente')}>Encaminhar Interno</button>
                    <button className="btn-mini" type="button" onClick={() => aplicarMovimentacao('Encaminhados Externamente')}>Encaminhar Externo</button>
                    <button className="btn-mini" type="button" onClick={() => aplicarMovimentacao('Em analise')}>Em analise</button>
                    <button className="btn-mini" type="button" onClick={() => aplicarMovimentacao('Finalizado')}>Finalizar</button>
                  </div>
                </div>

                <div className="modal-form-grid">
                  <label>
                    Status
                    <select value={form.status} onChange={(e) => updateForm('status', e.target.value)}>
                      <option value="Recebido">Recebido</option>
                      <option value="Encaminhados Externamente">Encaminhados Externamente</option>
                      <option value="Encaminhado Internamente">Encaminhado Internamente</option>
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
                  <label>
                    Destino
                    <input type="text" value={form.destino} onChange={(e) => updateForm('destino', e.target.value)} />
                  </label>
                  <label>
                    Prazo dias uteis
                    <input type="number" min={0} value={form.prazoDiasUteis} onChange={(e) => updateForm('prazoDiasUteis', e.target.value)} />
                  </label>
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
