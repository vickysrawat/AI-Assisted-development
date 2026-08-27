import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { LeaveRequest, NewLeaveRequest } from './leave.model';

export interface ListResult {
  requests: LeaveRequest[];
  error: string | null;
}

/**
 * Talks to the leave-request REST API. Every read path resolves to a ListResult
 * so components can render an error banner without a try/catch of their own.
 */
@Injectable({ providedIn: 'root' })
export class LeaveApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/leave`;

  /** GET the current employee's requests. Maps 404 to an empty list, other errors to a banner. */
  listMine(employeeId: string): Observable<ListResult> {
    return this.http.get<LeaveRequest[]>(`${this.base}?employeeId=${employeeId}`).pipe(
      map((requests) => ({ requests, error: null })),
      catchError((err: HttpErrorResponse) => {
        if (err.status === 404) {
          // Treat "no requests yet" as an empty, non-error result.
          return of({ requests: [], error: null });
        }
        return of({ requests: [], error: 'Could not load your leave requests.' });
      }),
    );
  }

  /** POST a new leave request. Surfaces a user-facing message on failure. */
  submit(employeeId: string, req: NewLeaveRequest): Observable<LeaveRequest> {
    return this.http
      .post<LeaveRequest>(this.base, { ...req, employeeId })
      .pipe(
        catchError((err: HttpErrorResponse) => {
          const message =
            err.status === 409
              ? 'You already have a request for those dates.'
              : 'Could not submit your leave request. Please try again.';
          return throwError(() => new Error(message));
        }),
      );
  }
}
