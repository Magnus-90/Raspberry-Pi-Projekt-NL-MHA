import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { ThemeService } from '../services/theme-service';

// on = normal, dim = Stand-by (dunkler, Berührung weckt), sleep = Ruhemodus (aus, nur die Uhrzeit weckt)
type DisplayState = 'on' | 'dim' | 'sleep';

const IDLE_MS = 1 * 30_000;
const BACKEND_URL = `http://${window.location.hostname}:5000`;

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  host: {
    '(document:pointerdown)': 'onActivity()',
    '(document:keydown)': 'onActivity()',
  },
})
export class App implements OnInit, OnDestroy {
  protected readonly title = signal('frontend');
  protected readonly displayState = signal<DisplayState>('on');
  private router = inject(Router);
  private versionTimer?: ReturnType<typeof setInterval>;
  private sleepTimer?: ReturnType<typeof setInterval>;
  private idleTimer?: ReturnType<typeof setTimeout>;
  private currentIndex?: string;
  private sleepFrom = '';
  private sleepTo = '';
  theme = inject(ThemeService);

  private async fetchIndex(): Promise<string | undefined> {
    try {
      const response = await fetch('/index.html', { cache: 'no-store' });
      return response.ok ? await response.text() : undefined;
    } catch {
      return undefined;
    }
  }

  async ngOnInit() {
    // Nach einem Neustart des Browsers kann das Display noch dunkel sein, darum den Zustand einmal setzen
    await this.checkSleepTime();
    if (this.displayState() === 'on') {
      this.wake();
    }
    this.sleepTimer = setInterval(() => this.checkSleepTime(), 60_000);

    this.currentIndex = await this.fetchIndex();
    await this.theme.loadColorSettings();
    this.versionTimer = setInterval(async () => {
      const latest = await this.fetchIndex();
      if (!latest){
        return;
      }
      if (!this.currentIndex){
        this.currentIndex = latest;
      } else if (latest !== this.currentIndex) {
        location.reload();
      }
    }, 5 * 60000)
  }

  // Jede Berührung im Normalbetrieb startet die 1 Minuten neu
  onActivity() {
    if (this.displayState() === 'on') {
      this.restartIdleTimer();
    }
  }

  // Klick auf das Overlay: weckt nur aus dem Stand-by, nicht aus dem Ruhemodus
  onOverlayClick() {
    if (this.displayState() === 'dim') {
      this.wake();
    }
  }

  private wake() {
    this.setState('on');
    this.restartIdleTimer();
  }

  private restartIdleTimer() {
    clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      this.setState('dim');
      this.router.navigateByUrl('/');
    }, IDLE_MS);
  }

  // Lädt die Zeiten jede Minute neu, damit Änderungen im Admin Panel ohne Neustart greifen
  private async checkSleepTime() {
    try {
      const response = await fetch(`${BACKEND_URL}/settings`);
      if (response.ok) {
        const settings = await response.json();
        this.sleepFrom = settings.sleepfrom ?? '';
        this.sleepTo = settings.sleepto ?? '';
      }
    } catch {
      // Backend nicht erreichbar: mit den zuletzt bekannten Zeiten weitermachen
    }

    const sleeping = this.isSleepTime(new Date());
    if (sleeping && this.displayState() !== 'sleep') {
      clearTimeout(this.idleTimer);
      this.setState('sleep');
    } else if (!sleeping && this.displayState() === 'sleep') {
      this.wake();
    }
  }

  private isSleepTime(now: Date) {
    if (!this.sleepFrom || !this.sleepTo || this.sleepFrom === this.sleepTo) {
      return false;
    }
    // "HH:MM" lässt sich als String vergleichen, weil die Stunden zweistellig sind
    const current = now.toTimeString().slice(0, 5);
    return this.sleepFrom < this.sleepTo
      ? current >= this.sleepFrom && current < this.sleepTo
      : current >= this.sleepFrom || current < this.sleepTo; // über Mitternacht, z. B. 19:00–07:00
  }

  // Der Host-Helfer regelt die Hintergrundbeleuchtung, das Overlay deckt den Bildschirm zusätzlich ab
  private setState(state: DisplayState) {
    this.displayState.set(state);
    fetch(`${BACKEND_URL}/display`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state }),
    }).catch(() => console.log('Display konnte nicht geschaltet werden'));
  }

  ngOnDestroy(): void {
    clearInterval(this.versionTimer);
    clearInterval(this.sleepTimer);
    clearTimeout(this.idleTimer);
  }
}
