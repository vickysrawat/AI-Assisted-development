import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { environment } from '../../environments/environment';

/**
 * Custom validator: a single request may not exceed the configured maximum
 * number of leave days. Returns { overLimit: { max, actual } } when violated,
 * otherwise null. The message is owned by the component that displays it.
 */
export function maxLeaveDaysValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = Number(control.value);
    if (Number.isNaN(value)) {
      return null; // let Validators.required / type handling deal with empties
    }
    if (value > environment.maxLeaveDays) {
      return { overLimit: { max: environment.maxLeaveDays, actual: value } };
    }
    return null;
  };
}

export const OVER_LIMIT_MESSAGE = 'Requested days exceed the maximum allowed per request.';
