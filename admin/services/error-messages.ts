export type ApiErrorCode =
  | 'VALIDATION_FAILED'
  | 'INVALID_DATE_RANGE'
  | 'UNAUTHENTICATED'
  | 'INVALID_CREDENTIALS'
  | 'FORBIDDEN'
  | 'MECHANIC_NOT_FOUND'
  | 'NO_MATCHING_MECHANICS'
  | 'EMAIL_TAKEN'
  | 'NOT_IMPLEMENTED'
  | 'DATABASE_BUSY'
  | 'INTERNAL_ERROR'
  | 'NETWORK_UNAVAILABLE';

const GENERIC_ERROR_MESSAGE = 'Algo deu errado. Tente novamente.';

const ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  VALIDATION_FAILED: 'Verifique os dados informados e tente novamente.',
  INVALID_DATE_RANGE: 'A data inicial não pode ser depois da data final.',
  UNAUTHENTICATED: 'Sua sessão expirou. Entre novamente.',
  INVALID_CREDENTIALS: 'E-mail ou senha inválidos.',
  FORBIDDEN: 'Você não tem permissão para esta ação.',
  MECHANIC_NOT_FOUND: 'Mecânico não encontrado.',
  NO_MATCHING_MECHANICS: 'Nenhum mecânico encontrado.',
  EMAIL_TAKEN: 'Este e-mail já está cadastrado.',
  NOT_IMPLEMENTED: 'Recurso indisponível nesta versão.',
  DATABASE_BUSY: 'Servidor ocupado. Tente novamente.',
  INTERNAL_ERROR: GENERIC_ERROR_MESSAGE,
  NETWORK_UNAVAILABLE: 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
};

export function getApiErrorMessage(code?: string | null): string {
  return ERROR_MESSAGES[code as ApiErrorCode] ?? GENERIC_ERROR_MESSAGE;
}
