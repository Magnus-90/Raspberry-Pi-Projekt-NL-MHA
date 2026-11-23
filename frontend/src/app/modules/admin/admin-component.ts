import { Component, ElementRef, OnDestroy, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { MatTimepickerModule } from '@angular/material/timepicker';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { provideNativeDateAdapter } from '@angular/material/core';
import { DEFAULT_PRIMARY, DEFAULT_SECONDARY, ThemeService } from '../../../services/theme-service';
import { DashboardLayout } from '../../../services/dashboard-layout';
import { Point } from '@angular/cdk/drag-drop';

const TOKEN_KEY = 'admin-token';

// Ruhemodus-Zeiten werden als "HH:MM" gespeichert, der Timepicker arbeitet mit Date
function toTimeString(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function fromTimeString(time: string): Date | null {
  const [hours, minutes] = time.split(':').map(Number);
  if (!time || isNaN(hours) || isNaN(minutes)) {
    return null;
  }
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

@Component({
  selector: 'app-admin-component',
  imports: [MatFormFieldModule, MatInputModule, MatTimepickerModule],
  providers: [provideNativeDateAdapter()],
  templateUrl: './admin-component.html',
  styleUrl: './admin-component.scss',
})
export class AdminComponent implements OnInit, OnDestroy {
  private url = `http://${window.location.hostname}:5000`;
  public systemstats = signal<any>(null);
  public publictransportlocation = signal('');
  public weatherlocation = signal('');
  public sleepFrom = signal<Date | null>(null);
  public sleepTo = signal<Date | null>(null);
  public error = signal('');
  public info = signal('');
  public password = signal('');
  private token = signal(sessionStorage.getItem(TOKEN_KEY) ?? '');
  public loggedIn = computed(() => this.token() !== '');
  private timer?: ReturnType<typeof setInterval>;
  private theme = inject(ThemeService);
  public primarycolor = signal(DEFAULT_PRIMARY);
  public secondarycolor = signal(DEFAULT_SECONDARY);
  public darkmode = signal(false);

  private authHeaders() {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.token()}`,
    };
  }

  logout(message = '') {
    sessionStorage.removeItem(TOKEN_KEY);
    this.token.set('');
    this.systemstats.set(null);
    this.info.set('');
    this.error.set(message);
  }

  async login(event: Event) {
    event.preventDefault();
    this.error.set('');
    try {
      const response = await fetch(`${this.url}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: this.password() }),
      });
      if (!response.ok) {
        this.error.set(
          response.status === 401
            ? 'Falsches Passwort'
            : `Login fehlgeschlagen: ${response.status}`,
        );
        return;
      }
      const data = await response.json();
      sessionStorage.setItem(TOKEN_KEY, data.token);
      this.token.set(data.token);
      this.password.set('');
      await this.loadData();
    } catch (error) {
      this.error.set(`Login fehlgeschlagen: ${error}`);
    }
  }

  setPrimaryColor(value: string) {
    this.primarycolor.set(value);
    this.previewColors();
  }

  setSecondaryColor(value: string) {
    this.secondarycolor.set(value);
    this.previewColors();
  }

  resetColors() {
    this.primarycolor.set(DEFAULT_PRIMARY);
    this.secondarycolor.set(DEFAULT_SECONDARY);
    this.previewColors();
  }

  setDarkmode(enabled: boolean) {
    this.darkmode.set(enabled);
    this.theme.applyDarkmode(enabled);
  }

  private previewColors() {
    this.theme.applyColors(this.primarycolor(), this.secondarycolor());
  }

  async getsystemStats() {
    try {
      const response = await fetch(`${this.url}/health`);
      if (!response.ok) {
        this.error.set(`Fehler beim laden der Systeminformationen: ${response.status}`);
        return;
      }
      const data = await response.json();
      this.systemstats.set(data);
      this.error.set('');
    } catch (error) {
      this.error.set(`Fehler beim laden der Systeminformationen: ${error}`);
    }
  }

  async saveSettings() {
    const from = this.sleepFrom();
    const to = this.sleepTo();
    try {
      const respone = await fetch(`${this.url}/settings`, {
        method: 'POST',
        headers: this.authHeaders(),
        body: JSON.stringify({
          weatherlocation: this.weatherlocation(),
          publictransportlocation: this.publictransportlocation(),
          primarycolor: this.primarycolor(),
          secondarycolor: this.secondarycolor(),
          darkmode: String(this.darkmode()),
          // Leer schaltet den Ruhemodus aus
          sleepfrom: from ? toTimeString(from) : '',
          sleepto: to ? toTimeString(to) : '',
        }),
      });
      if (respone.status === 401) {
        this.logout('Sitzung abgelaufen, bitte neu anmelden');
        return;
      }
      if (!respone.ok) {
        // Grund vom Backend anzeigen, z.B. "Ungültige Uhrzeit für sleepfrom"
        const data = await respone.json().catch(() => ({}));
        this.error.set(`Fehler beim Speichern: ${data.error ?? respone.status} ${data.details ?? ''}`);
        return;
      }
      this.error.set('');
    } catch (error) {
      this.error.set(`Fehler beim Speichern: ${error}`);
    }
  }

  private async sendCommand(path: string, label: string) {
    this.error.set('');
    this.info.set('');
    try {
      const response = await fetch(`${this.url}/${path}`, {
        method: 'POST',
        headers: this.authHeaders(),
      });
      if (response.status === 401) {
        this.logout('Sitzung abgelaufen, bitte neu anmelden');
        return;
      }
      if (!response.ok) {
        this.error.set(`${label} fehlgeschlagen: ${response.status}`);
        return;
      }
      this.info.set(`${label} gestartet`);
    } catch (error) {
      this.error.set(`${label} fehlgeschlagen: ${error}`);
    }
  }

  async updatePi() {
    await this.sendCommand('update', 'Update');
  }

  async restartPi() {
    if (!confirm('Sind sie sich sicher das sie den Raspberry Pi neu Starten möchten?')) {
      return;
    }
    await this.sendCommand('restart', 'Neustart');
  }

  async getSettings() {
    try {
      const response = await fetch(`${this.url}/settings`, {
        method: 'GET',
      });
      if (!response.ok) {
        this.error.set(`Fehler beim Settings Laden: ${response.status}`);
        return;
      }
      const data = await response.json();
      return data;
    } catch (error) {
      this.error.set(`Fehler beim Settings Laden: ${error}`);
    }
  }

  private async loadData() {
    const settings = await this.getSettings();
    await this.getsystemStats();
    if (settings == undefined) {
      return;
    }
    this.publictransportlocation.set(settings.publictransportlocation ?? '');
    this.weatherlocation.set(settings.weatherlocation ?? '');
    this.sleepFrom.set(fromTimeString(settings.sleepfrom ?? ''));
    this.sleepTo.set(fromTimeString(settings.sleepto ?? ''));
    this.primarycolor.set(settings.primarycolor || DEFAULT_PRIMARY);
    this.secondarycolor.set(settings.secondarycolor || DEFAULT_SECONDARY);
    this.darkmode.set(settings.darkmode === 'true');
  }

  async ngOnInit() {
    this.timer = setInterval(async () => {
      if (this.loggedIn()) {
        await this.getsystemStats();
      }
    }, 10000);
    if (this.loggedIn()) {
      await this.loadData();
    }
  }

  ngOnDestroy() {
    clearInterval(this.timer);
  }
}
