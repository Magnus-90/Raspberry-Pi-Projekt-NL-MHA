import { DatePipe } from '@angular/common';
import { booleanAttribute, Component, input, OnDestroy, signal } from '@angular/core';

@Component({
  selector: 'app-time',
  imports: [],
  templateUrl: './time.html',
  styleUrl: './time.scss',
})
export class TimeConponent implements OnDestroy {
  time = signal(new Date().toLocaleTimeString());
  private id = setInterval(() => this.time.set(new Date().toLocaleTimeString()), 1000);
  detail = input(false, { transform: booleanAttribute });
  public calendarWeek = signal(this.getCalendarWeek(new Date));
  public currentTimeZone = signal(Intl.DateTimeFormat().resolvedOptions().timeZone);
  public nextTimeSwitchDate = signal(this.findNextTimeSwitch(new Date));
  public dayProgress = signal(this.getDayProgress())

  getCurrentDate(){
    const date = new Date().toLocaleDateString('de-CH',{
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    return date;
  }

  getCalendarWeek(date : Date){
    const tempDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = tempDate.getUTCDay() || 7;
    tempDate.setUTCDate(tempDate.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(tempDate.getUTCFullYear(), 0, 1));
    return Math.ceil((((tempDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  private findNextTimeSwitch(from = new Date()) {
    const DAY = 24 * 3_600_000;
    const offset = (ms: number) => new Date(ms).getTimezoneOffset();
    let start = from.getTime();
    for (let i = 0; i < 366; i++) {
      const end = start + DAY;
      if (offset(start) !== offset(end)) {
        let lo = start, hi = end;
        while (hi - lo > 60_000) {
          const mid = Math.floor((lo + hi) / 2);
          if (offset(mid) === offset(start)) lo = mid; else hi = mid;
        }
        return { date: new Date(hi), toSummer: offset(end) < offset(start) };
      }
      start = end;
    }
    return null;   // z. B. Asien/Tokio: keine Zeitumstellung
  }

  formatDate(date: Date) {
    return date.toLocaleDateString('de-CH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  getDayProgress(now = new Date()){
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const currentProgress = ((now.getTime() - start.getTime()) / (end.getTime() - start.getTime())) * 100;
    return Math.round(currentProgress);
  }

  ngOnDestroy() {
    clearInterval(this.id);
  }
}
