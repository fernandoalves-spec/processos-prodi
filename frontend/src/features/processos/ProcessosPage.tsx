import { useEffect, useMemo, useState } from 'react';
import { listarProcessos } from '../../services/processosService';
import { ProcessoItem } from '../../types/processos';

interface ProcessosPageProps {
  enabled: boolean;
}

type SortField = 'protocolo' | 'assunto' | 'status' | 'tramitacao' | 'atualizacao';
type SortDirection = 'asc' | 'desc';

function formatarData(value?: string | null) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('pt-BR');
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
  const [sortField, setSortField] = useState<SortField>('atualizacao');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    if (!enabled) {
      setProcessos([]);
      setErro(null);
      return;
    }

    setLoading(true);
    setErro(null);
    listarProcessos()
      .then((dados) => {
        setProcessos(dados);
      })
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

    const sorted = [...filtrados].sort((a, b) => {
      const valueA = (() => {
        if (sortField === 'protocolo') return String(a.protocolo || '').toLowerCase();
        if (sortField === 'assunto') return String(a.assunto || '').toLowerCase();
        if (sortField === 'status') return String(a.status || '').toLowerCase();
        if (sortField === 'tramitacao') return `${a.origem || ''}->${a.destino || ''}`.toLowerCase();
        return new Date(a.atualizadoEm || a.criadoEm || 0).getTime();
      })();

      const valueB = (() => {
        if (sortField === 'protocolo') return String(b.protocolo || '').toLowerCase();
        if (sortField === 'assunto') return String(b.assunto || '').toLowerCase();
        if (sortField === 'status') return String(b.status || '').toLowerCase();
        if (sortField === 'tramitacao') return `${b.origem || ''}->${b.destino || ''}`.toLowerCase();
        return new Date(b.atualizadoEm || b.criadoEm || 0).getTime();
      })();

      if (valueA < valueB) return sortDirection === 'asc' ? -1 : 1;
      if (valueA > valueB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
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
    if (sortField !== field) return '↕';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  const irPaginaAnterior = () => {
    setPaginaAtual((prev) => Math.max(1, prev - 1));
  };

  const irPaginaSeguinte = () => {
    setPaginaAtual((prev) => Math.min(totalPaginas, prev + 1));
  };

  const processosFiltrados = useMemo(() => {
    return processos.filter((item) => {
      const termo = busca.trim().toLowerCase();
      if (termo) {
        const alvo = `${item.protocolo} ${item.assunto} ${item.origem || ''} ${item.destino || ''}`.toLowerCase();
        if (!alvo.includes(termo)) return false;
      }
      if (status && item.status !== status) return false;
      return true;
    });
  }, [processos, busca, status]);

  return (
    <>
      <section className="panel">
        <div className="panel-title">
          <h2>Gestao de Processos</h2>
          <span>Lista detalhada e tramitacao por processo</span>
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
                      <th>
                        <button className="th-sort" type="button" onClick={() => alterarOrdenacao('tramitacao')}>
                          Tramitacao {labelOrdenacao('tramitacao')}
                        </button>
                      </th>
                      <th>
                        <button className="th-sort" type="button" onClick={() => alterarOrdenacao('atualizacao')}>
                          Atualizacao {labelOrdenacao('atualizacao')}
                        </button>
                      </th>
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
                        <td>{`${item.origem || '-'} -> ${item.destino || '-'}`}</td>
                        <td>{formatarData(item.atualizadoEm || item.criadoEm)}</td>
                      </tr>
                    ))}
                    {!processosPaginados.length ? (
                      <tr>
                        <td colSpan={5} className="muted">
                          Nenhum processo encontrado para os filtros aplicados.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <div className="paginacao">
                <span>
                  {processosFiltrados.length} processo(s) · pagina {paginaCorrigida} de {totalPaginas}
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
          </>
        )}
      </section>
    </>
  );
}
