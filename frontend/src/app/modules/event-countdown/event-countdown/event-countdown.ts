import { DatePipe } from '@angular/common';
import { Component, computed, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';


interface CountdownEvent {
  id: string;
  name: string;
  time: string;
}

interface EventData {
  name: string;
  time: string;
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
  public showForm = signal(false);
  public formValues = signal<EventData>({ name: '', time: '' });

  upcomingEvents = computed(() =>
    this.events().filter((event) => new Date(event.time).getTime() > this.now().getTime()),
  );

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

  getNextEvent() {
    const now = Date.now();
    return this.events().find((event) => new Date(event.time).getTime() > now);
  }

  showEventForm(){
    this.showForm.set(true);
  }

  hideEventForm(){
    this.showForm.set(false);
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
