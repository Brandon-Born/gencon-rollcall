import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { SessionStore } from '../session/session-store';
import { AuthSession } from './auth-session';

export const authorizedGuard: CanActivateFn = async () => {
  const authSession = inject(AuthSession);
  const router = inject(Router);

  await authSession.whenReady();

  return authSession.isAuthorized() ? true : router.parseUrl('/gate');
};

export const gateGuard: CanActivateFn = async () => {
  const authSession = inject(AuthSession);
  const router = inject(Router);

  await authSession.whenReady();

  return authSession.isAuthorized() ? router.parseUrl('/app/map') : true;
};

export const onboardingGuard: CanActivateFn = async () => {
  const authSession = inject(AuthSession);
  const router = inject(Router);
  const session = inject(SessionStore);

  await authSession.whenReady();

  if (!authSession.isAuthorized()) {
    return router.parseUrl('/gate');
  }

  return session.displayName().trim() ? router.parseUrl('/app/map') : true;
};

export const onboardedGuard: CanActivateFn = async () => {
  const authSession = inject(AuthSession);
  const router = inject(Router);
  const session = inject(SessionStore);

  await authSession.whenReady();

  if (!authSession.isAuthorized()) {
    return router.parseUrl('/gate');
  }

  return session.displayName().trim() ? true : router.parseUrl('/onboarding');
};
