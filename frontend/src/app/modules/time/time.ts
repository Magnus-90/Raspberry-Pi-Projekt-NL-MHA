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

  getCurrentDate(){
    const date = new Date().toLocaleDateString('de-CH',{
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    return date;
  }

  ngOnDestroy() {
    clearInterval(this.id);
  }
}
