export type LeaveType = 'annual' | 'sick' | 'unpaid';

export type LeaveStatus = 'pending' | 'approved' | 'rejected';

export interface LeaveRequest {
  id: string;
  employeeId: string;
  type: LeaveType;
  startDate: string; // ISO date
  days: number;
  reason: string;
  status: LeaveStatus;
}

export interface NewLeaveRequest {
  type: LeaveType;
  startDate: string;
  days: number;
  reason: string;
}
