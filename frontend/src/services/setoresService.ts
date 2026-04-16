import { SetorItem } from '../types/setores';

interface CriarSetorInput {
  nome: string;
  sigla: string;
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

