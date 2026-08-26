import { TestBed } from '@angular/core/testing';
import { PermissionService } from './permission.service';
import { AuthService } from './auth.service';

describe('PermissionService.canApproveLeave', () => {
  let service: PermissionService;
  let auth: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PermissionService);
    auth = TestBed.inject(AuthService);
  });

  it('denies an employee', () => {
    auth.setUser({ id: 'e-1', name: 'Emp', role: 'employee' });
    expect(service.canApproveLeave()).toBe(false);
  });

  it('allows a manager', () => {
    auth.setUser({ id: 'm-1', name: 'Mgr', role: 'manager' });
    expect(service.canApproveLeave()).toBe(true);
  });

  it('denies when no user is signed in', () => {
    auth.setUser(null);
    expect(service.canApproveLeave()).toBe(false);
  });
});
