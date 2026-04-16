import { useEffect, useMemo, useState } from 'react';
import { atualizarGutProcesso, listarProcessos } from '../../services/processosService';
import { ProcessoItem } from '../../types/processos';

interface GutPageProps {
  enabled: boolean;
  isAdminMaster: boolean;
}

interface GutFormState {
  id: number;
  protocolo: string;
  assunto: string;
  gutGravidade: string;
  gutUrgencia: string;
  gutTendencia: string;
}

const GUT_GRAVIDADE_OPCOES = [
  { label: 'Nao e Grave', pontos: 1 },
  { label: 'Pouco Grave', pontos: 2 },
  { label: 'Grave', pontos: 3 },
  { label: 'Muito Grave', pontos: 4 },
  { label: 'Gravissimo', pontos: 5 }
];
const GUT_URGENCIA_OPCOES = [
  { label: 'Nao tem pressa', pontos: 1 },
  { label: 'Pode esperar um pouco', pontos: 2 },
  { label: 'Resolver o mais cedo possivel', pontos: 3 },
  { label: 'Resolver com alguma urgencia', pontos: 4 },
  { label: 'Necessita de acao imediata', pontos: 5 }
];
const GUT_TENDENCIA_OPCOES = [
  { label: 'Nao vai piorar', pontos: 1 },
  { label: 'Vai piorar em longo prazo', pontos: 2 },
  { label: 'Vai piorar em medio prazo', pontos: 3 },
  { label: 'Vai piorar em pouco tempo', pontos: 4 },
  { label: 'Vai piorar rapidamente', pontos: 5 }
];

const pontosGravidade = new Map(GUT_GRAVIDADE_OPCOES.map((item) => [item.label, item.pontos]));
const pontosUrgencia = new Map(GUT_URGENCIA_OPCOES.map((item) => [item.label, item.pontos]));
const pontosTendencia = new Map(GUT_TENDENCIA_OPCOES.map((item) => [item.label, item.pontos]));

function getPontos(
  mapa: Map<string, number>,
  valor: string | null | undefined
): number | null {
  if (!valor) return null;
  return mapa.get(valor) ?? null;
}

export function GutPage({ enabled, isAdminMaster }: GutPageProps) {
  const [processos, setProcessos] = useState<ProcessoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const [form, setForm] = useState<GutFormState | null>(null);

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
      .catch(() => setErro('Nao foi possivel carregar os processos para priorizacao GUT.'))
      .finally(() => setLoading(false));
  }, [enabled]);

  const processosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return processos;
    return processos.filter((item) => `${item.protocolo} ${item.assunto}`.toLowerCase().includes(termo));
  }, [processos, busca]);

  const abrirModal = (processo: ProcessoItem) => {
    setForm({
      id: processo.id,
      protocolo: processo.protocolo || '',
      assunto: processo.assunto || '',
      gutGravidade: processo.gutGravidade || '',
      gutUrgencia: processo.gutUrgencia || '',
      gutTendencia: processo.gutTendencia || ''
    });
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setForm(null);
  };

  const updateForm = <K extends keyof GutFormState>(campo: K, valor: GutFormState[K]) => {
    setForm((atual) => (atual ? { ...atual, [campo]: valor } : atual));
  };

  const gravidadePontos = getPontos(pontosGravidade, form?.gutGravidade);
  const urgenciaPontos = getPontos(pontosUrgencia, form?.gutUrgencia);
  const tendenciaPontos = getPontos(pontosTendencia, form?.gutTendencia);
  const prioridadePreview =
    gravidadePontos !== null && urgenciaPontos !== null && tendenciaPontos !== null
      ? gravidadePontos + urgenciaPontos + tendenciaPontos
      : null;

  const salvarGut = async () => {
    if (!form) return;

    if (!form.protocolo.trim() || !form.assunto.trim()) {
      setErro('Informe protocolo e assunto para salvar a matriz GUT.');
      return;
    }

    setSalvando(true);
    setErro(null);
    try {
      const processoAtualizado = await atualizarGutProcesso(form.id, {
        protocolo: form.protocolo.trim(),
        assunto: form.assunto.trim(),
        gutGravidade: form.gutGravidade || null,
        gutUrgencia: form.gutUrgencia || null,
        gutTendencia: form.gutTendencia || null
      });

      setProcessos((atual) => atual.map((item) => (item.id === processoAtualizado.id ? processoAtualizado : item)));
      fecharModal();
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Nao foi possivel salvar a matriz GUT.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <section className="panel">
      <div className="panel-title">
        <h2>Priorizacao GUT</h2>
        <span>Gravidade (Impacto), Urgencia (Tempo de resposta) e Tendencia (Evolucao do risco)</span>
      </div>

      {!enabled ? (
        <p className="muted">Autentique-se para visualizar a priorizacao GUT.</p>
      ) : (
        <>
          <div className="processos-filtros">
            <label>
              Buscar
              <input
                type="text"
                placeholder="Protocolo ou assunto"
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
              />
            </label>
          </div>

          {!isAdminMaster ? <div className="loading-inline">Somente Administrador Master pode editar a matriz GUT.</div> : null}
          {erro ? <div className="error">{erro}</div> : null}
          {loading ? <div className="loading-inline">Carregando processos...</div> : null}

          <div className="processos-tabela-wrap">
            <table className="processos-tabela gut-tabela">
              <thead>
                <tr>
                  <th>Protocolo</th>
                  <th>Assunto</th>
                  <th>Gravidade (Impacto)</th>
                  <th>Urgencia (Tempo de resposta)</th>
                  <th>Tendencia (Evolucao do risco)</th>
                  <th>Prioridade Final (G+U+T)</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {processosFiltrados.map((item) => (
                  <tr key={item.id}>
                    <td>{item.protocolo}</td>
                    <td>{item.assunto}</td>
                    <td>{item.gutGravidade || '-'}</td>
                    <td>{item.gutUrgencia || '-'}</td>
                    <td>{item.gutTendencia || '-'}</td>
                    <td>
                      <span className="gut-prioridade">{item.gutPrioridadeFinal ?? '-'}</span>
                    </td>
                    <td>
                      {isAdminMaster ? (
                        <button className="btn-mini gut-editar" type="button" onClick={() => abrirModal(item)}>
                          Editar GUT
                        </button>
                      ) : (
                        <span className="muted">Somente leitura</span>
                      )}
                    </td>
                  </tr>
                ))}
                {!processosFiltrados.length ? (
                  <tr>
                    <td colSpan={7} className="muted">
                      Nenhum processo encontrado.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {modalAberto && form ? (
            <div className="modal-overlay" role="dialog" aria-modal="true">
              <div className="modal-card">
                <div className="panel-title">
                  <h3>Editar Matriz GUT</h3>
                  <button className="btn-mini" type="button" onClick={fecharModal}>
                    Fechar
                  </button>
                </div>

                <div className="gut-form-grid">
                  <label className="field-span-2">
                    Protocolo do Processo
                    <input type="text" value={form.protocolo} onChange={(event) => updateForm('protocolo', event.target.value)} />
                  </label>
                  <label className="field-span-2">
                    Assunto do processo
                    <input type="text" value={form.assunto} onChange={(event) => updateForm('assunto', event.target.value)} />
                  </label>

                  <label>
                    Gravidade (Impacto)
                    <select value={form.gutGravidade} onChange={(event) => updateForm('gutGravidade', event.target.value)}>
                      <option value="">Selecione</option>
                      {GUT_GRAVIDADE_OPCOES.map((item) => (
                        <option key={item.label} value={item.label}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Pontuacao da gravidade
                    <input type="text" value={gravidadePontos ?? ''} readOnly />
                  </label>

                  <label>
                    Urgencia (Tempo de resposta)
                    <select value={form.gutUrgencia} onChange={(event) => updateForm('gutUrgencia', event.target.value)}>
                      <option value="">Selecione</option>
                      {GUT_URGENCIA_OPCOES.map((item) => (
                        <option key={item.label} value={item.label}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Pontuacao da urgencia
                    <input type="text" value={urgenciaPontos ?? ''} readOnly />
                  </label>

                  <label>
                    Tendencia (Evolucao do risco)
                    <select value={form.gutTendencia} onChange={(event) => updateForm('gutTendencia', event.target.value)}>
                      <option value="">Selecione</option>
                      {GUT_TENDENCIA_OPCOES.map((item) => (
                        <option key={item.label} value={item.label}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Pontuacao da tendencia
                    <input type="text" value={tendenciaPontos ?? ''} readOnly />
                  </label>

                  <label className="field-span-2">
                    Prioridade Final (G+U+T)
                    <input type="text" value={prioridadePreview ?? ''} readOnly />
                  </label>
                </div>

                <div className="modal-actions">
                  <button className="btn-mini" type="button" onClick={fecharModal}>
                    Cancelar
                  </button>
                  <button className="btn-mini" type="button" onClick={salvarGut} disabled={salvando}>
                    {salvando ? 'Salvando...' : 'Salvar GUT'}
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

