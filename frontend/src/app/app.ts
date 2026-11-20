import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from '../services/theme-service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit, OnDestroy {
  protected readonly title = signal('frontend');
  private versionTimer?: ReturnType<typeof setInterval>;
  private currentIndex?: string;
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

  ngOnDestroy(): void {
    clearInterval(this.versionTimer);
  }
}
