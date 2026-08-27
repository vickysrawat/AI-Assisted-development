import { Component } from '@angular/core';

@Component({
  selector: 'app-approvals',
  standalone: true,
  imports: [],
  template: `
    <h2>Pending Approvals</h2>
    <p>Only managers and admins can see this screen.</p>
  `,
})
export class ApprovalsComponent {}
