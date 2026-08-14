export type ApiErrorCode =
  | 'VALIDATION_FAILED'
  | 'UNAUTHENTICATED'
  | 'INVALID_CREDENTIALS'
  | 'FORBIDDEN'
  | 'MECHANIC_NOT_FOUND'
  | 'TIMESLOT_NOT_FOUND'
  | 'APPOINTMENT_NOT_FOUND'
  | 'NOTIFICATION_NOT_FOUND'
  | 'EMAIL_TAKEN'
  | 'TIMESLOT_UNAVAILABLE'
  | 'TIMESLOT_EXPIRED'
  | 'TIMESLOT_OVERLAP'
  | 'TIMESLOT_HAS_APPOINTMENT'
  | 'MECHANIC_UNAVAILABLE'
  | 'APPOINTMENT_NOT_CANCELLABLE'
  | 'APPOINTMENT_ALREADY_COMPLETED'
  | 'APPOINTMENT_NOT_COMPLETABLE'
  | 'NOT_IMPLEMENTED'
  | 'DATABASE_BUSY'
  | 'INTERNAL_ERROR'
  | 'NETWORK_UNAVAILABLE'
  | 'REQUEST_TIMEOUT';

const GENERIC_ERROR_MESSAGE = 'Algo deu errado. Tente novamente.';

const ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  VALIDATION_FAILED: 'Verifique os dados informados e tente novamente.',
  UNAUTHENTICATED: 'Sua sessão expirou. Entre novamente.',
  INVALID_CREDENTIALS: 'E-mail ou senha inválidos.',
  FORBIDDEN: 'Você não tem permissão para esta ação.',
  MECHANIC_NOT_FOUND: 'Mecânico não encontrado.',
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
