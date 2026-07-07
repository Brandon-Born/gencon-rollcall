import { Component } from '@angular/core';

const people = [
  { initials: 'AC', name: 'Alex Carter', status: 'Available', note: 'At Exhibit Hall', updated: '9:40 AM', tone: 'green' },
  { initials: 'JW', name: 'Jamie Wu', status: 'Gaming', note: 'Board gaming area', updated: '9:38 AM', tone: 'blue' },
  { initials: 'MK', name: 'Morgan K.', status: 'Heading somewhere', note: 'On my way from Hall D', updated: '9:35 AM', tone: 'gold' },
  { initials: 'LD', name: 'Lee D.', status: 'Offline', note: 'Out for the afternoon', updated: '9:28 AM', tone: 'gray' }
];

@Component({
  selector: 'app-people-page',
  template: `
    <main class="page">
      <header>
        <h1>People</h1>
        <p>Recent statuses and notes from the crew.</p>
      </header>

      <section class="list" aria-label="Group status list">
        @for (person of people; track person.initials) {
          <article class="person">
            <span class="avatar" [class]="person.tone">{{ person.initials }}</span>
            <div>
              <div class="row">
                <strong>{{ person.name }}</strong>
                <time>{{ person.updated }}</time>
              </div>
              <p class="status">{{ person.status }}</p>
              <p>{{ person.note }}</p>
            </div>
          </article>
        }
      </section>
    </main>
  `,
  styles: `
    .page {
      min-height: 100svh;
      padding: 22px 16px;
      background: var(--color-bg);
    }

    h1 {
      margin: 0;
      color: var(--color-text);
      font-size: 28px;
    }

    header p {
      margin: 6px 0 18px;
      color: var(--color-muted);
    }

    .list {
      display: grid;
      gap: 10px;
    }

    .person {
      display: grid;
      grid-template-columns: 52px 1fr;
      gap: 13px;
      padding: 14px;
      border: 1px solid var(--color-border);
      border-radius: 14px;
      background: var(--color-surface);
    }

    .avatar {
      width: 48px;
      height: 48px;
      display: grid;
      place-items: center;
      border: 3px solid var(--color-map-blue);
      border-radius: 999px;
      color: var(--color-text);
      font-weight: 900;
    }

    .avatar.green {
      border-color: var(--color-green);
    }

    .avatar.gold {
      border-color: var(--color-gold);
    }

    .avatar.gray {
      border-color: var(--color-muted);
    }

    .row {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
    }

    strong {
      color: var(--color-text);
      font-size: 16px;
    }

    time {
      color: var(--color-muted);
      font-size: 12px;
      font-weight: 700;
    }

    p {
      margin: 4px 0 0;
      color: var(--color-muted);
      font-size: 14px;
    }

    .status {
      color: var(--color-text);
      font-weight: 800;
    }
  `
})
export class PeoplePage {
  readonly people = people;
}
