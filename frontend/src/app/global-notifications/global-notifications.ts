import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { CountdownEvent, nextOccurrence } from '../modules/event-countdown/event-countdown/event-countdown';

interface AppNotification {
  id: string;
  type: 'transport' | 'event';
  severity: 'info' | 'warning' | 'critical';
  text: string;
  until: number;
}

// Events werden so viele Minuten vor dem Start gemeldet
const EVENT_LEAD_MIN = 15;

@Component({
  selector: 'app-global-notifications',
  imports: [],
  templateUrl: './global-notifications.html',
  styleUrl: './global-notifications.scss',
})
export class GlobalNotifications implements OnInit, OnDestroy {
  public url = `http://${window.location.hostname}:5000`;

  notifications = signal<AppNotification[]>([
    // { id: 'test-1', type: 'event', severity: 'info', text: 'Test: Event beginnt in 15 Min.' },
    // { id: 'test-2', type: 'transport', severity: 'info', text: 'Test: S 21 nach Appenzell +5 Min.' },
  ]);

  private reported: string[] = [];

  add(n: AppNotification) {
    const list = this.notifications();
    if(!this.reported.includes(n.id)){
      this.reported.push(n.id);
      this.notifications.set([...list, n]);
      return;
    }

    for(let i = 0; i < list.length; i++){
      if(list[i].id === n.id){
        const newList = [...list];
        newList[i] = n;
        this.notifications.set(newList);
        return;
      }
    }
  }

  dismiss(id: string) {
    const newList: AppNotification[] = [];
    for (const n of this.notifications()){
      if  (n.id !== id){
        newList.push(n);
      }
    }
    this.notifications.set(newList);
  }

  private removeExpired(){
    const now = Date.now();
    const newList: AppNotification[] = [];
    for (const n of this.notifications()){
      if(n.until > now){
        newList.push(n);
      }
    }
    this.notifications.set(newList);
  }

  private stationboard: any[] = [];
  private publicTransportFetchTimer?: ReturnType<typeof setInterval>;
  private publicTransportCheckTimer?: ReturnType<typeof setInterval>;
  private events: CountdownEvent[] = [];
  private eventFetchTimer?: ReturnType<typeof setInterval>;
  private eventCheckTimer?: ReturnType<typeof setInterval>;

  private async loadEvents() {
    try {
      const response = await fetch(`${this.url}/events`);
      if (!response.ok) return;
      this.events = await response.json();
      } catch (e) {
        console.error('Events fetch failed', e);
    }
  }

  private checkEvents() {
    const now = Date.now();
    for (const event of this.events) {
      const time = nextOccurrence(event, now).getTime();
      const minutes = Math.ceil((time - now) / 60000);
      if (minutes > 0 && minutes <= EVENT_LEAD_MIN) {
        this.add({
          id: `event-${event.id}-${time}`,
          type: 'event',
          severity: 'info',
          text: `${event.name} beginnt in ${minutes} Min.`,
          until: time,
        });
      }
    }
  }

  public async loadPublicTransportSettings(){
    const response = await fetch(`${this.url}/settings`, {
      method: "GET"
    })
    if(!response.ok){
      console.log("Fehler beim Public Transport Settings laden")
      return ""
    }
    const data = await response.json()
    return data?.publictransportlocation ?? ""
  }

  public async getPublicTransportData(location : string){
    if(!location){
      return null;
    }
    const response = await fetch(
      `https://transport.opendata.ch/v1/stationboard?station=${encodeURIComponent(location)}&limit=10`,
    );
    const data = await response.json();
    console.log(data);
    return data;
  }


  public async loadDelays(){
    try {
      const location = await this.loadPublicTransportSettings();
      const data = await this.getPublicTransportData(location);
      this.stationboard = data?.stationboard ?? [];
    } catch (e) {
      console.error('Delays fetch failed', e);
    }
  }

  public checkDelays(){
    this.removeExpired();
    const now = Date.now();
    for (const item of this.stationboard){
      const delay = item.stop.delay;
      const planned = item.stop.departureTimestamp * 1000;
      const actual = planned + delay * 60000;
      const id = `delay-${item.name}-${item.stop.departureTimestamp}`;
      if (delay > 0 && planned < now + 30 * 60000 && actual > now) {
        let severity: AppNotification['severity'] = 'info';
        if (delay >= 10) {
          severity = 'warning';
        }
        this.add({
          id: id,
          type: 'transport',
          severity: severity,
          text: `${item.category} ${item.number} nach ${item.to}: +${delay} Min.`,
          until: actual,
        })
      } else {
        this.dismiss(id);
        const pos = this.reported.indexOf(id);
        if (pos >= 0) {
          this.reported.splice(pos, 1);
        }
      }
    }
  }

  async ngOnInit() {
    await this.loadEvents();
    await this.loadDelays();
    this.checkEvents();
    this.checkDelays();
    this.eventFetchTimer = setInterval(() => {
      this.loadEvents();
    }, 300000);
    this.publicTransportFetchTimer = setInterval(() => {
      this.loadDelays();
    }, 60000);
    this.eventCheckTimer = setInterval(() => {
      this.checkEvents();
    }, 30000);
    this.publicTransportCheckTimer = setInterval(() => {
      this.checkDelays();
    }, 30000);
  }

  ngOnDestroy() {
    clearInterval(this.eventFetchTimer);
    clearInterval(this.eventCheckTimer);
    clearInterval(this.publicTransportFetchTimer);
    clearInterval(this.publicTransportCheckTimer);
  }
}
