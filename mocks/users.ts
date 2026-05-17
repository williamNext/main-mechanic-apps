import { User, Mechanic } from '@/types/models';

export const mockAdmin: User = {
  id: 'admin-1',
  name: 'Carlos Administrador',
  email: 'admin@oficina.com',
  role: 'admin',
  phone: '11999990000',
  createdAt: '2026-01-01T00:00:00Z',
};

export const mockMechanics: Mechanic[] = [
  {
    id: 'mech-1',
    name: 'João Silva',
    email: 'joao@oficina.com',
    role: 'mechanic',
    specialty: 'Motor',
    credentials: 'CREA-SP 123456',
    phone: '11999991111',
    avatarUrl: undefined,
    createdAt: '2026-01-15T00:00:00Z',
  },
  {
    id: 'mech-2',
    name: 'Pedro Santos',
    email: 'pedro@oficina.com',
    role: 'mechanic',
    specialty: 'Elétrica',
    credentials: 'CREA-SP 654321',
    phone: '11999992222',
    avatarUrl: undefined,
    createdAt: '2026-02-01T00:00:00Z',
  },
  {
    id: 'mech-3',
    name: 'Ana Oliveira',
    email: 'ana@oficina.com',
    role: 'mechanic',
    specialty: 'Suspensão',
    credentials: 'CREA-SP 789012',
    phone: '11999993333',
    avatarUrl: undefined,
    createdAt: '2026-02-15T00:00:00Z',
  },
  {
    id: 'mech-4',
    name: 'Roberto Lima',
    email: 'roberto@oficina.com',
    role: 'mechanic',
    specialty: 'Freios',
    credentials: 'CREA-SP 345678',
    phone: '11999994444',
    avatarUrl: undefined,
    createdAt: '2026-03-01T00:00:00Z',
  },
];

export const mockClients: User[] = [
  {
    id: 'client-1',
    name: 'Maria Fernandes',
    email: 'maria@email.com',
    role: 'client',
    phone: '11988881111',
    createdAt: '2026-03-10T00:00:00Z',
  },
  {
    id: 'client-2',
    name: 'Lucas Almeida',
    email: 'lucas@email.com',
    role: 'client',
    phone: '11988882222',
    createdAt: '2026-03-15T00:00:00Z',
  },
];
