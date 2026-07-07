import { Routes } from '@angular/router';

import { authorizedGuard, gateGuard, onboardedGuard, onboardingGuard } from './core/auth/auth-guards';

export const routes: Routes = [
  {
    path: 'gate',
    canActivate: [gateGuard],
    loadComponent: () => import('./features/gate/gate').then((m) => m.Gate)
  },
  {
    path: 'onboarding',
    canActivate: [onboardingGuard],
    loadComponent: () => import('./features/onboarding/onboarding').then((m) => m.Onboarding)
  },
  {
    path: 'app',
    canActivate: [authorizedGuard, onboardedGuard],
    loadComponent: () => import('./features/shell/shell').then((m) => m.Shell),
    children: [
      {
        path: 'map',
        loadComponent: () => import('./features/map/map-page').then((m) => m.MapPage)
      },
      {
        path: 'people',
        loadComponent: () => import('./features/people/people-page').then((m) => m.PeoplePage)
      },
      {
        path: 'rallies',
        loadComponent: () => import('./features/rallies/rallies-page').then((m) => m.RalliesPage)
      },
      {
        path: 'settings',
        loadComponent: () => import('./features/settings/settings-page').then((m) => m.SettingsPage)
      },
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'map'
      }
    ]
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'gate'
  },
  {
    path: '**',
    redirectTo: 'gate'
  }
];
