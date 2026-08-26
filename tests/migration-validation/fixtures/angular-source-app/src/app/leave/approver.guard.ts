import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { PermissionService } from './permission.service';

/**
 * Route guard for the approvals screen. Two-level indirection:
 *   guard fn -> PermissionService.canApproveLeave() -> AuthService.currentUser()
 *
 * Employees are redirected to their own request list; unknown users go to /login.
 */
export const approverGuard: CanActivateFn = (): boolean | UrlTree => {
  const permissions = inject(PermissionService);
  const router = inject(Router);

  if (permissions.canApproveLeave()) {
    return true;
  }

  // Not permitted: send them somewhere sensible instead of a blank cancel.
  return router.parseUrl('/my-requests');
};
