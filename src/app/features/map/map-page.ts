import { Component, computed, signal } from '@angular/core';

import { MemberStatus, STATUS_OPTIONS, statusLabel } from '../../shared/status/status-options';

interface MapPin {
  initials: string;
  name: string;
  x: number;
  y: number;
  status: MemberStatus;
}

@Component({
  selector: 'app-map-page',
  template: `
    <main class="map-page">
      <header>
        <div>
          <p>Gen Con Roll Call</p>
          <h1>Shared map</h1>
        </div>
        <button type="button">Hide me</button>
      </header>

      <section class="map-frame" aria-label="Convention map prototype">
        <div class="map-art">
          <span class="street top">Georgia Street</span>
          <span class="street bottom">Capitol Avenue</span>
          <div class="hall hall-a">Hall A</div>
          <div class="hall hall-b">Hall B</div>
          <div class="hall hall-c">Hall C</div>
          <div class="hall exhibit">Exhibit Hall</div>
          <div class="hall event">Event Hall</div>
          <div class="hall hall-d">Hall D</div>
          <div class="hall hall-e">Hall E</div>
          <div class="concourse">Grand Concourse</div>

          @for (pin of pins; track pin.initials) {
            <button
              type="button"
              class="pin"
              [class]="pin.status"
              [style.left.%]="pin.x"
              [style.top.%]="pin.y"
              [attr.aria-label]="pin.name + ', ' + labelFor(pin.status)"
            >
              {{ pin.initials }}
            </button>
          }
        </div>
      </section>

      <section class="status-sheet">
        <div class="sheet-header">
          <div>
            <p>Your status</p>
            <strong>{{ selectedStatusLabel() }}</strong>
          </div>
          <span>Updated just now</span>
        </div>

        <div class="status-grid" aria-label="Choose status">
          @for (status of statuses; track status.value) {
            <button
              type="button"
              [class.active]="selectedStatus() === status.value"
              (click)="selectedStatus.set(status.value)"
            >
              {{ status.label }}
            </button>
          }
        </div>

        <label>
          <span>Note</span>
          <input
            type="text"
            maxlength="80"
            placeholder="Booth 2110, skywalk, running late..."
            [value]="note()"
            (input)="note.set($any($event.target).value)"
          />
        </label>
      </section>
    </main>
  `,
  styles: `
    .map-page {
      min-height: 100svh;
      padding: 14px 14px 18px;
      background: var(--color-bg);
    }

    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 12px;
    }

    header p,
    .sheet-header p {
      margin: 0 0 3px;
      color: var(--color-muted);
      font-size: 12px;
      font-weight: 800;
    }

    h1 {
      margin: 0;
      color: var(--color-text);
      font-size: 26px;
      line-height: 1.1;
    }

    header button {
      min-height: 40px;
      padding: 0 14px;
      border: 1px solid var(--color-border);
      border-radius: 999px;
      background: var(--color-surface);
      color: var(--color-text);
      font-size: 13px;
      font-weight: 800;
    }

    .map-frame {
      overflow: hidden;
      height: min(58svh, 560px);
      min-height: 390px;
      border: 1px solid var(--color-border);
      border-radius: 16px;
      background: var(--color-surface);
      box-shadow: 0 14px 36px rgba(15, 23, 42, 0.1);
    }

    .map-art {
      position: relative;
      height: 100%;
      width: 100%;
      background:
        linear-gradient(rgba(47, 128, 237, 0.07) 1px, transparent 1px),
        linear-gradient(90deg, rgba(47, 128, 237, 0.07) 1px, transparent 1px),
        #f6f8fb;
      background-size: 28px 28px;
    }

    .street {
      position: absolute;
      right: 18px;
      left: 18px;
      color: var(--color-muted);
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 0.06em;
      text-align: center;
      text-transform: uppercase;
    }

    .street.top {
      top: 10px;
    }

    .street.bottom {
      bottom: 10px;
    }

    .hall,
    .concourse {
      position: absolute;
      display: grid;
      place-items: center;
      border: 1px solid rgba(47, 128, 237, 0.18);
      color: #11315f;
      font-weight: 900;
      text-align: center;
      text-transform: uppercase;
    }

    .hall {
      background: #c7d9ee;
    }

    .hall-a {
      top: 16%;
      left: 6%;
      width: 21%;
      height: 17%;
    }

    .hall-b {
      top: 36%;
      left: 6%;
      width: 21%;
      height: 17%;
    }

    .hall-c {
      top: 62%;
      left: 6%;
      width: 24%;
      height: 18%;
    }

    .exhibit {
      top: 16%;
      left: 36%;
      width: 30%;
      height: 20%;
    }

    .event {
      top: 58%;
      left: 36%;
      width: 30%;
      height: 20%;
    }

    .hall-d {
      top: 31%;
      right: 6%;
      width: 19%;
      height: 17%;
    }

    .hall-e {
      top: 61%;
      right: 6%;
      width: 19%;
      height: 17%;
    }

    .concourse {
      top: 39%;
      left: 30%;
      width: 38%;
      height: 16%;
      background: rgba(255, 255, 255, 0.74);
      border-style: dashed;
    }

    .pin {
      position: absolute;
      width: 46px;
      height: 46px;
      transform: translate(-50%, -50%);
      border: 3px solid var(--color-map-blue);
      border-radius: 999px;
      background: var(--color-surface);
      box-shadow: 0 8px 20px rgba(15, 23, 42, 0.22);
      color: var(--color-text);
      font-size: 14px;
      font-weight: 900;
    }

    .pin.available {
      border-color: var(--color-green);
    }

    .pin.heading-somewhere,
    .pin.vendor-hall {
      border-color: var(--color-gold);
    }

    .pin.offline,
    .pin.hotel-resting {
      border-color: var(--color-muted);
    }

    .status-sheet {
      position: relative;
      z-index: 2;
      margin-top: -28px;
      padding: 18px;
      border: 1px solid var(--color-border);
      border-radius: 16px 16px 0 0;
      background: var(--color-surface);
      box-shadow: 0 -10px 36px rgba(15, 23, 42, 0.13);
    }

    .sheet-header {
      display: flex;
      align-items: start;
      justify-content: space-between;
      gap: 14px;
    }

    .sheet-header strong {
      color: var(--color-text);
      font-size: 20px;
    }

    .sheet-header span {
      color: var(--color-muted);
      font-size: 12px;
      font-weight: 700;
    }

    .status-grid {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      margin: 18px -18px 16px;
      padding: 0 18px 2px;
    }

    .status-grid button {
      flex: 0 0 auto;
      min-height: 38px;
      padding: 0 13px;
      border: 1px solid var(--color-border);
      border-radius: 999px;
      background: var(--color-surface);
      color: var(--color-text);
      font-size: 13px;
      font-weight: 800;
    }

    .status-grid button.active {
      border-color: var(--color-gencon-red);
      background: rgba(214, 56, 47, 0.1);
      color: var(--color-gencon-red);
    }

    label {
      display: grid;
      gap: 7px;
      color: var(--color-muted);
      font-size: 12px;
      font-weight: 800;
    }

    input {
      min-height: 44px;
      padding: 0 12px;
      border: 1px solid var(--color-border);
      border-radius: 10px;
      color: var(--color-text);
      font-size: 15px;
      font-weight: 600;
    }
  `
})
export class MapPage {
  readonly statuses = STATUS_OPTIONS;
  readonly selectedStatus = signal<MemberStatus>('available');
  readonly selectedStatusLabel = computed(() => statusLabel(this.selectedStatus()));
  readonly note = signal('');

  readonly pins: readonly MapPin[] = [
    { initials: 'JW', name: 'Jamie Wu', x: 39, y: 27, status: 'available' },
    { initials: 'MK', name: 'Morgan K.', x: 69, y: 35, status: 'heading-somewhere' },
    { initials: 'TS', name: 'Taylor S.', x: 29, y: 69, status: 'gaming' },
    { initials: 'AC', name: 'Alex Carter', x: 57, y: 54, status: 'available' }
  ];

  labelFor(status: MemberStatus): string {
    return statusLabel(status);
  }
}
