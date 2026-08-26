import { Injectable, signal } from '@angular/core';

export type Role = 'employee' | 'manager' | 'admin';

export interface CurrentUser {
  id: string;
  name: string;
  role: Role;
}

/**
 * Holds the signed-in user. In a real app this would be seeded from a token;
 * here it is an in-memory signal so the guard has something to read.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly user = signal<CurrentUser | null>({
    id: 'e-100',
    name: 'Dana Employee',
    role: 'employee',
  });

  currentUser(): CurrentUser | null {
    return this.user();
  }

  isAuthenticated(): boolean {
    return this.user() !== null;
  }

  setUser(user: CurrentUser | null): void {
    this.user.set(user);
  }
}
