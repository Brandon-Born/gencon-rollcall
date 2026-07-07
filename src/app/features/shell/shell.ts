import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="app-shell">
      <router-outlet />

      <nav class="tab-bar" aria-label="Main navigation">
        <a routerLink="/app/map" routerLinkActive="active">
          <strong>Map</strong>
        </a>
        <a routerLink="/app/people" routerLinkActive="active">
          <strong>People</strong>
        </a>
        <a routerLink="/app/rallies" routerLinkActive="active">
          <strong>Rally Points</strong>
        </a>
        <a routerLink="/app/settings" routerLinkActive="active">
          <strong>Settings</strong>
        </a>
      </nav>
    </div>
  `,
  styles: `
    .app-shell {
      min-height: 100svh;
      padding-bottom: calc(74px + env(safe-area-inset-bottom));
      background: var(--color-bg);
    }

    .tab-bar {
      position: fixed;
      right: 0;
      bottom: 0;
      left: 0;
      z-index: 20;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 4px;
      padding: 8px 10px calc(8px + env(safe-area-inset-bottom));
      border-top: 1px solid var(--color-border);
      background: rgba(255, 255, 255, 0.94);
      backdrop-filter: blur(16px);
    }

    a {
      min-height: 54px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 10px;
      color: var(--color-muted);
      font-size: 12px;
      font-weight: 800;
      text-decoration: none;
    }

    a.active {
      background: rgba(214, 56, 47, 0.09);
      color: var(--color-gencon-red);
    }
  `
})
export class Shell {}
