import { mechanics, profiles, type Role } from '../db/schema.js';

export const profileUserColumns = {
  id: profiles.id,
  name: profiles.name,
  email: profiles.email,
  role: profiles.role,
  phone: profiles.phone,
  avatarUrl: profiles.avatarUrl,
  specialty: mechanics.specialty,
};

type ProfileUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone: string | null;
  avatarUrl: string | null;
  specialty: string | null;
};

export function serializeProfileUser(profile: ProfileUser): ProfileUser {
  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    role: profile.role,
    phone: profile.phone,
    avatarUrl: profile.avatarUrl,
    specialty: profile.specialty,
  };
}
