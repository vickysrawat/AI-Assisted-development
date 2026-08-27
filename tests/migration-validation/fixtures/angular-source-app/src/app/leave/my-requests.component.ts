import { Component, OnInit, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { LeaveApiService } from './leave-api.service';
import { LeaveRequest } from './leave.model';

@Component({
  selector: 'app-my-requests',
  standalone: true,
  imports: [],
  template: `
    @if (loading()) {
      <p>Loading…</p>
    } @else if (error()) {
      <div class="banner error">{{ error() }}</div>
    } @else if (requests().length === 0) {
      <p class="empty">You have no leave requests yet.</p>
    } @else {
      <ul>
        @for (r of requests(); track r.id) {
          <li>{{ r.startDate }} — {{ r.days }} day(s) — {{ r.status }}</li>
        }
      </ul>
    }
  `,
})
export class MyRequestsComponent implements OnInit {
  private readonly api = inject(LeaveApiService);
  private readonly auth = inject(AuthService);

  readonly requests = signal<LeaveRequest[]>([]);
  readonly error = signal<string | null>(null);
  readonly loading = signal(true);

  ngOnInit(): void {
    const employeeId = this.auth.currentUser()?.id ?? 'unknown';
    this.api.listMine(employeeId).subscribe((result) => {
      this.requests.set(result.requests);
      this.error.set(result.error);
      this.loading.set(false);
    });
  }
}
