import { User } from '@/types/models';
import { request } from './api';

export async function updateMyProfile(data: Pick<User, 'name'>): Promise<User> {
  return request<User>('/profiles/me', {
    method: 'PATCH',
    body: data,
  });
}
