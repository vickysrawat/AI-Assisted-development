import { Injectable, inject } from '@angular/core';
import { AuthService, Role } from './auth.service';

/**
 * Central place for role-based access decisions. The guard does not talk to
 * AuthService directly — it goes through here (guard fn -> PermissionService ->
 * AuthService), so authorisation rules live in one testable spot.
 */
@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly auth = inject(AuthService);

  /** Roles allowed to reach the approvals screen. */
  private readonly approverRoles: Role[] = ['manager', 'admin'];

  canApproveLeave(): boolean {
    const user = this.auth.currentUser();
    if (!user) {
      return false;
    }
    return this.approverRoles.includes(user.role);
  }
}
