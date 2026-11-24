import { DatePipe } from '@angular/common';
import { Component, ElementRef, computed, OnDestroy, OnInit, signal, viewChild, input, booleanAttribute } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';

export type Repeat = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface CountdownEvent {
  id: string;
  name: string;
  time: string;
  series?: boolean;
  repeat?: Repeat;
}

interface EventData {
  name: string;
  time: string;
  series?: boolean;
  repeat?: Repeat;
}

const DAY_MS = 24 * 60 * 60 * 1000;
// Untergrenze der Periodenlänge, damit der Startindex nie zu hoch geschätzt wird
const MIN_PERIOD_MS: Record<Exclude<Repeat, 'none'>, number> = {
  daily: DAY_MS,
  weekly: 7 * DAY_MS,
  monthly: 31 * DAY_MS,
  yearly: 366 * DAY_MS,
};

// Der k-te Termin der Serie; Monats-/Jahresende wird auf den letzten Tag begrenzt (31. -> 28./30.)
function occurrenceAt(start: Date, repeat: Exclude<Repeat, 'none'>, k: number): Date {
  const date = new Date(start);
  if (repeat === 'daily') {
    date.setDate(start.getDate() + k);
  } else if (repeat === 'weekly') {
    date.setDate(start.getDate() + 7 * k);
  } else {
    const months = repeat === 'monthly' ? k : 12 * k;
    date.setDate(1);
    date.setMonth(start.getMonth() + months);
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    date.setDate(Math.min(start.getDate(), lastDay));
  }
  return date;
}

export function nextOccurrence(event: CountdownEvent, now: number): Date {
  const start = new Date(event.time);
  if (!event.series || !event.repeat || event.repeat === 'none' || start.getTime() > now) {
    return start;
  }
  let k = Math.max(0, Math.floor((now - start.getTime()) / MIN_PERIOD_MS[event.repeat]) - 1);
  let date = occurrenceAt(start, event.repeat, k);
  while (date.getTime() <= now) {
    k++;
    date = occurrenceAt(start, event.repeat, k);
  }
  return date;
}

@Component({
  selector: 'app-event-countdown',
  imports: [DatePipe, FormsModule],
  templateUrl: './event-countdown.html',
  styleUrl: './event-countdown.scss',
})
export class EventCountdown implements OnInit, OnDestroy {
  public url = `http://${window.location.hostname}:5000`;
  public events = signal<CountdownEvent[]>([]);
  private now = signal(new Date());
  public error = signal("");
  private id = setInterval(() => {
    this.now.set(new Date());
    this.updateCountdown();
  }, 1000);
  public days = signal(0);
  public hours = signal(0);
  public minutes = signal(0);
  public seconds = signal(0);
  public formValues = signal<EventData>({ name: '', time: '' });
  detail = input(false, { transform: booleanAttribute });

  upcomingEvents = computed(() => {
    const now = this.now().getTime();
    return this.events()
      .map((event) => ({ ...event, time: nextOccurrence(event, now).toISOString() }))
      .filter((event) => new Date(event.time).getTime() > now)
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  });

  singleEvents = computed(() => this.upcomingEvents().filter((event) => !event.series));

  private eventDialog = viewChild.required<ElementRef<HTMLDialogElement>>('eventDialog');

  async getEvents(){
    const response = await fetch(`${this.url}/events`, {
      method: "GET"
    })
    if(!response.ok){
      throw new Error(`Event antwortet mit ${response.status}`);
    }
    const data = await response.json()
    this.events.set(data);
    return;
  }

  getNextEvent() : any {
    return this.upcomingEvents()[0];
  }

showEventForm() {
  this.eventDialog().nativeElement.showModal();
}

hideEventForm() {
  this.eventDialog().nativeElement.close();
}

  onSubmit(form: NgForm) {
    if (form.valid) {
      this.formValues.set(form.value);
      console.log('Daten:', this.formValues()); 
      this.sendEventForm();
    }
  }

  async sendEventForm() {
    const currentData = this.formValues();
    const response = await fetch(`${this.url}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: currentData.name,
        time: new Date(currentData.time).toISOString(),
        series: !!currentData.series,
        ...(currentData.series ? { repeat: currentData.repeat ?? 'weekly' } : {}),
      }),
    });
    if (!response.ok) {
      this.error.set("Event konnte nicht gespeichert werden");
      return;
    }
    this.error.set("");
    this.hideEventForm();
    await this.loadEventData();
  }


  async loadEventData(){
    try {
      await this.getEvents()
      this.error.set("");
    } catch (e) {
      console.error('Events fetch failed', e);
      this.error.set("Events konnten nicht geladen werden");
    }
  }

  private updateCountdown() {
    const nextEvent = this.getNextEvent();
    if (!nextEvent) {
      this.days.set(0);
      this.hours.set(0);
      this.minutes.set(0);
      this.seconds.set(0);
      return;
    }
    const distance = new Date(nextEvent.time).getTime() - this.now().getTime();
    this.days.set(Math.floor(distance / (1000 * 60 * 60 * 24)));
    this.hours.set(Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));
    this.minutes.set(Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)));
    this.seconds.set(Math.floor((distance % (1000 * 60)) / 1000));
  }

  async ngOnInit() {
    await this.loadEventData();
    this.updateCountdown();
  }


  ngOnDestroy() {
    clearInterval(this.id);
  }
}
