import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthSession, AuthSessionFailure } from './auth-session';

interface PasswordVerificationResponse {
  ok: boolean;
  error?: string;
}

export type PasswordVerificationError =
  | 'missing-config'
  | 'invalid-password'
  | 'too-many-attempts'
  | 'server-not-configured'
  | 'firebase-not-configured'
  | 'auth-required'
  | 'network-error'
  | 'unknown-error';

@Injectable({ providedIn: 'root' })
export class PasswordVerification {
  private readonly authSession = inject(AuthSession);
  private readonly http = inject(HttpClient);

  async verify(password: string): Promise<void> {
    const verificationUrl = environment.passwordVerificationUrl.trim();

    if (!verificationUrl) {
      throw new PasswordVerificationFailure('missing-config');
    }

    try {
      const user = await this.authSession.ensureAnonymousUser();
      const token = await user.getIdToken();
      const response = await firstValueFrom(
        this.http.post<PasswordVerificationResponse>(
          verificationUrl,
          { password },
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        )
      );

      if (!response.ok) {
        throw new PasswordVerificationFailure(this.mapError(response.error));
      }

      this.authSession.markAuthorized(user.uid);
    } catch (error) {
      if (error instanceof PasswordVerificationFailure) {
        throw error;
      }

      if (error instanceof AuthSessionFailure) {
        throw new PasswordVerificationFailure(error.code);
      }

      if (error instanceof HttpErrorResponse) {
        throw new PasswordVerificationFailure(this.mapHttpError(error));
      }

      throw new PasswordVerificationFailure('unknown-error');
    }
  }

  private mapHttpError(error: HttpErrorResponse): PasswordVerificationError {
    if (error.status === 0) {
      return 'network-error';
    }

    const responseError = typeof error.error?.error === 'string' ? error.error.error : undefined;
    return this.mapError(responseError);
  }

  private mapError(error: string | undefined): PasswordVerificationError {
    switch (error) {
      case 'invalid-password':
      case 'too-many-attempts':
      case 'server-not-configured':
      case 'auth-required':
        return error;
      default:
        return 'unknown-error';
    }
  }
}

export class PasswordVerificationFailure extends Error {
  constructor(readonly code: PasswordVerificationError) {
    super(code);
  }
}
