import { Component, OnDestroy, signal } from '@angular/core';

@Component({
  selector: 'app-time-conponent',
  imports: [],
  templateUrl: './time-conponent.html',
  styleUrl: './time-conponent.scss',
})
export class TimeConponent implements OnDestroy {
  time = signal(new Date().toLocaleTimeString());
  private id = setInterval(() => this.time.set(new Date().toLocaleTimeString()), 1000);

  getCurrentDate(){
    const date = new Date().toDateString();
    return date;
  }

  ngOnDestroy() {
    clearInterval(this.id);
  }
}
