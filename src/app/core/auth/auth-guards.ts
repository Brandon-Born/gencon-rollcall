import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { MemberProfile } from '../members/member-profile';
import { AuthSession } from './auth-session';

export const authorizedGuard: CanActivateFn = async () => {
  const authSession = inject(AuthSession);
  const router = inject(Router);

  await authSession.whenReady();

  return authSession.isAuthorized() ? true : router.parseUrl('/gate');
};

export const gateGuard: CanActivateFn = async () => {
  const authSession = inject(AuthSession);
  const memberProfile = inject(MemberProfile);
  const router = inject(Router);

  await authSession.whenReady();

  if (!authSession.isAuthorized()) {
    return true;
  }

  return await memberProfile.loadCurrentMember() ? router.parseUrl('/app/map') : router.parseUrl('/onboarding');
};

export const onboardingGuard: CanActivateFn = async () => {
  const authSession = inject(AuthSession);
  const memberProfile = inject(MemberProfile);
  const router = inject(Router);

  await authSession.whenReady();

  if (!authSession.isAuthorized()) {
    return router.parseUrl('/gate');
  }

  return await memberProfile.loadCurrentMember() ? router.parseUrl('/app/map') : true;
};

export const onboardedGuard: CanActivateFn = async () => {
  const authSession = inject(AuthSession);
  const memberProfile = inject(MemberProfile);
  const router = inject(Router);

  await authSession.whenReady();

  if (!authSession.isAuthorized()) {
    return router.parseUrl('/gate');
  }

  return await memberProfile.loadCurrentMember() ? true : router.parseUrl('/onboarding');
};
