import { Mechanic, User } from '@/types/models';
import { request } from './wire-client';

export async function updateMyProfile(data: Pick<Mechanic, 'name' | 'specialty'>): Promise<User> {
  return request<User>('/profiles/me', {
    method: 'PATCH',
    body: { name: data.name, specialty: data.specialty },
  });
}
