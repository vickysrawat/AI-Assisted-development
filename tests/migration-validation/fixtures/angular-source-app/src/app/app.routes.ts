import { Routes } from '@angular/router';
import { approverGuard } from './leave/approver.guard';
import { LeaveRequestFormComponent } from './leave/leave-request-form.component';
import { MyRequestsComponent } from './leave/my-requests.component';
import { ApprovalsComponent } from './leave/approvals.component';

export const routes: Routes = [
  { path: '', redirectTo: 'new-request', pathMatch: 'full' },
  { path: 'new-request', component: LeaveRequestFormComponent },
  { path: 'my-requests', component: MyRequestsComponent },
  {
    path: 'approvals',
    component: ApprovalsComponent,
    canActivate: [approverGuard],
  },
];
