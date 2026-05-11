// App-wide configuration constants

export const APP_NAME = 'Oficina';

export const SLOT_DURATION_MINUTES = 60;

export const SPECIALTIES = [
  'Motor',
  'Elétrica',
  'Suspensão',
  'Freios',
  'Câmbio',
  'Funilaria',
  'Pintura',
  'Ar Condicionado',
  'Injeção Eletrônica',
  'Geral',
] as const;

export const WORKING_HOURS = {
  start: '08:00',
  end: '18:00',
} as const;
