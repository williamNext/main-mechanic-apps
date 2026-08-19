import type { ErrorCode } from '../../../server/src/errors';

export type ApiErrorCode = ErrorCode | 'NETWORK_UNAVAILABLE' | 'REQUEST_TIMEOUT';

const GENERIC_ERROR_MESSAGE = 'Algo deu errado. Tente novamente.';

const ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  VALIDATION_FAILED: 'Verifique os dados informados e tente novamente.',
  INVALID_DATE_RANGE: 'A data inicial não pode ser depois da data final.',
  UNAUTHENTICATED: 'Sua sessão expirou. Entre novamente.',
  INVALID_CREDENTIALS: 'E-mail ou senha inválidos.',
  FORBIDDEN: 'Você não tem permissão para esta ação.',
  MECHANIC_NOT_FOUND: 'Mecânico não encontrado.',
  NO_MATCHING_MECHANICS: 'Nenhum mecânico encontrado.',
  TIMESLOT_NOT_FOUND: 'Horário não encontrado.',
  APPOINTMENT_NOT_FOUND: 'Agendamento não encontrado.',
  NOTIFICATION_NOT_FOUND: 'Notificação não encontrada.',
  EMAIL_TAKEN: 'Este e-mail já está cadastrado.',
  TIMESLOT_UNAVAILABLE: 'Horário indisponível. Escolha outro.',
  TIMESLOT_EXPIRED: 'Este horário já passou. Escolha outro.',
  TIMESLOT_OVERLAP: 'Este horário se sobrepõe a outro já cadastrado.',
  TIMESLOT_HAS_APPOINTMENT: 'Este horário possui um agendamento e não pode ser alterado.',
  MECHANIC_UNAVAILABLE: 'Este mecânico não está disponível no momento.',
  APPOINTMENT_NOT_CANCELLABLE: 'Este agendamento não pode mais ser cancelado.',
  APPOINTMENT_ALREADY_COMPLETED: 'Este agendamento já foi concluído.',
  APPOINTMENT_NOT_COMPLETABLE: 'Este agendamento não pode ser concluído.',
  NOT_IMPLEMENTED: 'Recurso indisponível nesta versão.',
  DATABASE_BUSY: 'Servidor ocupado. Tente novamente.',
  INTERNAL_ERROR: GENERIC_ERROR_MESSAGE,
  NETWORK_UNAVAILABLE: 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
  REQUEST_TIMEOUT: 'A solicitação demorou demais. Tente novamente.',
};

export function getApiErrorMessage(code?: string | null): string {
  return ERROR_MESSAGES[code as ApiErrorCode] ?? GENERIC_ERROR_MESSAGE;
}
