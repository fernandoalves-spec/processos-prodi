import { useEffect, useMemo, useState } from 'react';
import { listarProcessos } from '../../services/processosService';
import { ProcessoItem } from '../../types/processos';

interface ProcessosPageProps {
  enabled: boolean;
}

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
  const [processoSelecionadoId, setProcessoSelecionadoId] = useState<number | null>(null);

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
        if (dados.length) setProcessoSelecionadoId((atual) => atual ?? dados[0].id);
      })
      .catch(() => setErro('Nao foi possivel carregar a lista de processos.'))
      .finally(() => setLoading(false));
  }, [enabled]);

  const statusDisponiveis = useMemo(() => [...new Set(processos.map((p) => p.status))], [processos]);

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

  const processoSelecionado = processosFiltrados.find((item) => item.id === processoSelecionadoId) || null;

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
            </div>

            {erro ? <div className="error">{erro}</div> : null}
            {loading ? <div className="loading-inline">Carregando processos...</div> : null}

            <div className="processos-layout">
              <div className="processos-tabela-wrap">
                <table className="processos-tabela">
                  <thead>
                    <tr>
                      <th>Protocolo</th>
                      <th>Assunto</th>
                      <th>Status</th>
                      <th>Tramitacao</th>
                      <th>Atualizacao</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {processosFiltrados.map((item) => (
                      <tr key={item.id}>
                        <td>{item.protocolo}</td>
                        <td>{item.assunto}</td>
                        <td>
                          <span className={statusClass(item.status)}>{item.status}</span>
                        </td>
                        <td>{`${item.origem || '-'} -> ${item.destino || '-'}`}</td>
                        <td>{formatarData(item.atualizadoEm || item.criadoEm)}</td>
                        <td>
                          <button className="btn-mini" type="button" onClick={() => setProcessoSelecionadoId(item.id)}>
                            Detalhar
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!processosFiltrados.length ? (
                      <tr>
                        <td colSpan={6} className="muted">
                          Nenhum processo encontrado para os filtros aplicados.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              <aside className="processo-detalhe panel">
                <div className="panel-title">
                  <h3>Tramitacao do Processo</h3>
                </div>
                {processoSelecionado ? (
                  <div className="detalhe-conteudo">
                    <p>
                      <strong>Protocolo:</strong> {processoSelecionado.protocolo}
                    </p>
                    <p>
                      <strong>Assunto:</strong> {processoSelecionado.assunto}
                    </p>
                    <p>
                      <strong>Status:</strong> {processoSelecionado.status}
                    </p>
                    <p>
                      <strong>Origem:</strong> {processoSelecionado.origem || '-'}
                    </p>
                    <p>
                      <strong>Destino:</strong> {processoSelecionado.destino || '-'}
                    </p>
                    <p>
                      <strong>Prazo (dias uteis):</strong> {processoSelecionado.prazoDiasUteis ?? '-'}
                    </p>
                    <p>
                      <strong>Criado em:</strong> {formatarData(processoSelecionado.criadoEm)}
                    </p>
                    <p>
                      <strong>Atualizado em:</strong> {formatarData(processoSelecionado.atualizadoEm)}
                    </p>
                    <p>
                      <strong>Criado por:</strong> {processoSelecionado.criadoPor || '-'}
                    </p>
                    <p>
                      <strong>Atualizado por:</strong> {processoSelecionado.atualizadoPor || '-'}
                    </p>
                    {processoSelecionado.link ? (
                      <p>
                        <a href={processoSelecionado.link} target="_blank" rel="noreferrer">
                          Abrir documento vinculado
                        </a>
                      </p>
                    ) : null}
                    {processoSelecionado.observacao ? (
                      <p>
                        <strong>Observacao:</strong> {processoSelecionado.observacao}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className="muted">Selecione um processo para ver a tramitacao.</p>
                )}
              </aside>
            </div>
          </>
        )}
      </section>
    </>
  );
}
