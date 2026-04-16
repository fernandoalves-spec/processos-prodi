export interface CampusItem {
  id: number;
  nome: string;
  sigla: string;
  ativo: boolean;
  criadoEm?: string | null;
  atualizadoEm?: string | null;
}

