import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { LeaveApiService } from './leave-api.service';
import { maxLeaveDaysValidator, OVER_LIMIT_MESSAGE } from './leave-duration.validator';
import { environment } from '../../environments/environment';
import { LeaveType } from './leave.model';

@Component({
  selector: 'app-leave-request-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="onSubmit()">
      <select formControlName="type">
        <option value="annual">Annual</option>
        <option value="sick">Sick</option>
        <option value="unpaid">Unpaid</option>
      </select>

      <input type="date" formControlName="startDate" />

      <input type="number" formControlName="days" />
      @if (form.controls.days.hasError('required')) {
        <span class="err">Number of days is required.</span>
      }
      @if (form.controls.days.hasError('min')) {
        <span class="err">You must request at least one day.</span>
      }
      @if (form.controls.days.hasError('overLimit')) {
        <span class="err">{{ overLimitMessage }}</span>
      }

      <textarea formControlName="reason"></textarea>
      @if (form.controls.reason.hasError('required')) {
        <span class="err">A reason is required.</span>
      }

      <button type="submit" [disabled]="form.invalid">Submit</button>
    </form>

    @if (submitError()) {
      <div class="banner error">{{ submitError() }}</div>
    }
    @if (autoApproved()) {
      <div class="banner ok">Your short leave was approved automatically.</div>
    }
  `,
})
export class LeaveRequestFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(LeaveApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly overLimitMessage = OVER_LIMIT_MESSAGE;
  readonly submitError = signal<string | null>(null);
  readonly autoApproved = signal(false);

  readonly form = this.fb.nonNullable.group({
    type: this.fb.nonNullable.control<LeaveType>('annual', Validators.required),
    startDate: this.fb.nonNullable.control('', Validators.required),
    days: this.fb.nonNullable.control(1, [
      Validators.required,
      Validators.min(1),
      maxLeaveDaysValidator(),
    ]),
    reason: this.fb.nonNullable.control('', Validators.required),
  });

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const employeeId = this.auth.currentUser()?.id ?? 'unknown';

    // AMBIGUOUS: whether a 1-day request skips the approval queue depends on a
    // deploy-time feature flag, so the runtime behaviour is not knowable from
    // the source alone.
    if (environment.autoApproveShortLeave && value.days <= 1) {
      this.autoApproved.set(true);
    }

    this.submitError.set(null);
    this.api.submit(employeeId, value).subscribe({
      next: () => this.router.navigateByUrl('/my-requests'),
      error: (e: Error) => this.submitError.set(e.message),
    });
  }

  // Manual re-validation kept from an earlier revision. The submit button is
  // already gated on form.invalid and the form self-validates on every change,
  // so this method is never wired to anything.
  private revalidate(): boolean {
    this.form.updateValueAndValidity();
    if (this.form.valid) {
      return true;
    }
    // Dead branch: control-level validators already block submission, and this
    // method has no caller, so the code below never runs.
    this.submitError.set('Please fix the highlighted fields.');
    return false;
  }
}
