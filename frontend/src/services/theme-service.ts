import { Injectable } from '@angular/core';

export const DEFAULT_PRIMARY = '#2563eb';
export const DEFAULT_SECONDARY = '#64748b';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private url = `http://${window.location.hostname}:5000`;

  applyColors(primary?: string, secondary?: string) {
    const root = document.documentElement.style;
    root.setProperty('--color-primary', primary || DEFAULT_PRIMARY);
    root.setProperty('--color-secondary', secondary || DEFAULT_SECONDARY);
  }

  applyDarkmode(enabled: boolean) {
    if (enabled) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }

  async loadColorSettings() {
    try {
      const response = await fetch(`${this.url}/settings`);
      if (!response.ok) {
        return;
      }
      const data = await response.json();
      this.applyColors(data.primarycolor, data.secondarycolor);
      this.applyDarkmode(data.darkmode === 'true');
    } catch {
      // Backend nicht erreichbar: die Standardfarben aus styles.scss bleiben aktiv
    }
  }
}
