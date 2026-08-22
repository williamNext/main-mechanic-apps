import { ProfileUserResponse, UpdateProfileInput } from '@main-mechanic/types';
import { request } from '@main-mechanic/wire-client';

export async function updateMyProfile(data: UpdateProfileInput): Promise<ProfileUserResponse> {
  return request<ProfileUserResponse>('/profiles/me', {
    method: 'PATCH',
    body: { name: data.name, specialty: data.specialty },
  });
}
