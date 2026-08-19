import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  AUTH_TOKEN_KEY,
  getApiErrorMessage,
  request,
  SecureStorage,
  setStoredToken,
  type ApiErrorCode,
} from '../src';

const EXPECTED_MESSAGES = {
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
  INTERNAL_ERROR: 'Algo deu errado. Tente novamente.',
  NETWORK_UNAVAILABLE: 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
  REQUEST_TIMEOUT: 'A solicitação demorou demais. Tente novamente.',
} satisfies Record<ApiErrorCode, string>;

function response(body: unknown, init: ResponseInit = {}): Response {
  return new Response(body === undefined ? undefined : JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

describe('getApiErrorMessage', () => {
  it('maps a known code to Portuguese', () => {
    expect(getApiErrorMessage('INVALID_CREDENTIALS')).toBe('E-mail ou senha inválidos.');
  });

  it.each([undefined, null, 'UNKNOWN_CODE'])('uses the generic message for %s', (code) => {
    expect(getApiErrorMessage(code)).toBe('Algo deu errado. Tente novamente.');
  });

  it('translates every API error code', () => {
    for (const [code, message] of Object.entries(EXPECTED_MESSAGES)) {
      expect(getApiErrorMessage(code), code).toBe(message);
    }
  });
});

describe('request', () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('returns parsed JSON on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ id: 'profile-1' })));

    await expect(request<{ id: string }>('/profiles', { token: null })).resolves.toEqual({ id: 'profile-1' });
  });

  it('keeps server error message and code verbatim', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(response({ error: 'mechanic denied exact text', code: 'FORBIDDEN' }, { status: 403 })),
    );

    const error = await request('/mechanics', { token: null }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ message: 'mechanic denied exact text', code: 'FORBIDDEN', status: 403 });
  });

  it('keeps status when error body cannot be parsed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not-json', { status: 502, statusText: 'Bad Gateway' })));

    await expect(request('/health', { token: null })).rejects.toMatchObject({ status: 502, message: 'Bad Gateway' });
  });

  it('clears stored token after 401 with a token', async () => {
    await setStoredToken('expired-token');
    const removeItem = vi.spyOn(SecureStorage, 'removeItem');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ error: 'expired' }, { status: 401 })));

    await expect(request('/session')).rejects.toMatchObject({ status: 401 });

    expect(removeItem).toHaveBeenCalledWith(AUTH_TOKEN_KEY);
  });

  it('does not clear stored token after 401 without a token', async () => {
    const removeItem = vi.spyOn(SecureStorage, 'removeItem');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ error: 'missing' }, { status: 401 })));

    await expect(request('/session', { token: null })).rejects.toMatchObject({ status: 401 });

    expect(removeItem).not.toHaveBeenCalled();
  });

  it('resolves undefined for 204', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));

    await expect(request('/session', { method: 'DELETE', token: null })).resolves.toBeUndefined();
  });

  it('maps rejected fetch to network unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));

    await expect(request('/health', { token: null })).rejects.toMatchObject({
      code: 'NETWORK_UNAVAILABLE',
      message: 'network request failed',
      status: 0,
    });
  });

  it('maps exceeded deadline to request timeout', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})));

    const assertion = expect(request('/slow', { token: null })).rejects.toMatchObject({
      code: 'REQUEST_TIMEOUT',
      message: 'Request timed out',
      status: 0,
    });
    await vi.advanceTimersByTimeAsync(15000);

    await assertion;
  });

  it('adds authorization only when token exists', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(response({ ok: true })));
    vi.stubGlobal('fetch', fetchMock);

    await request('/with-token', { token: 'secret-token' });
    await request('/without-token', { token: null });

    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({ Authorization: 'Bearer secret-token' });
    expect(fetchMock.mock.calls[1]?.[1]?.headers).not.toHaveProperty('Authorization');
  });

  it('adds content type only when body exists', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(response({ ok: true })));
    vi.stubGlobal('fetch', fetchMock);

    await request('/with-body', { method: 'POST', body: { name: 'Ana' }, token: null });
    await request('/without-body', { method: 'POST', token: null });

    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({ 'Content-Type': 'application/json' });
    expect(fetchMock.mock.calls[1]?.[1]?.headers).not.toHaveProperty('Content-Type');
  });
});
