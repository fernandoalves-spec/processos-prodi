import { SetorItem } from '../types/setores';

interface CriarSetorInput {
  nome: string;
  sigla: string;
  campusId: number;
}

interface AtualizarSetorInput {
  nome: string;
  sigla: string;
  ativo: boolean;
  campusId: number;
}

interface HttpError extends Error {
  status?: number;
}

async function parseError(response: Response, fallbackMessage: string): Promise<HttpError> {
  const erro = new Error(fallbackMessage) as HttpError;
  erro.status = response.status;

  try {
    const payload = await response.json();
    if (payload?.erro) {
      erro.message = payload.erro;
      if (Array.isArray(payload.inconsistencias) && payload.inconsistencias.length) {
        const linhas = payload.inconsistencias
          .slice(0, 8)
          .map((item: { linha?: number; erro?: string }) => `Linha ${item.linha}: ${item.erro}`)
          .join(' | ');
        erro.message = `${payload.erro} ${linhas}`;
      }
    }
  } catch {
    // Mantem mensagem padrao.
  }

  return erro;
}

export async function listarSetoresTodos(): Promise<SetorItem[]> {
  const response = await fetch('/api/setores/todos');
  if (!response.ok) {
    throw await parseError(response, 'Falha ao carregar setores.');
  }
  return response.json();
}

export async function listarSetoresAtivos(): Promise<SetorItem[]> {
  const response = await fetch('/api/setores');
  if (!response.ok) {
    throw await parseError(response, 'Falha ao carregar setores ativos.');
  }
  return response.json();
}

export async function criarSetor(input: CriarSetorInput): Promise<SetorItem> {
  const response = await fetch('/api/setores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw await parseError(response, 'Falha ao cadastrar setor.');
  }

  const payload = await response.json();
  return payload.setor as SetorItem;
}

export async function atualizarSetor(id: number, input: AtualizarSetorInput): Promise<SetorItem> {
  const response = await fetch(`/api/setores/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw await parseError(response, 'Falha ao atualizar setor.');
  }

  const payload = await response.json();
  return payload.setor as SetorItem;
}

export async function importarSetoresPlanilha(arquivo: File): Promise<{
  mensagem: string;
  resumo: {
    totalLinhas: number;
    processadas: number;
    inseridos: number;
    atualizados: number;
    ignorados: number;
    semCampusVinculado: number;
  };
}> {
  const formData = new FormData();
  formData.append('arquivo', arquivo);

  const response = await fetch('/api/setores/importar-planilha', {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    throw await parseError(response, 'Falha ao importar planilha de setores.');
  }

  return response.json();
}
