import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
@Component({
  selector: 'app-public-transport',
  imports: [DatePipe],
  templateUrl: './public-transport.html',
  styleUrl: './public-transport.scss',
})
export class PublicTransport implements OnInit, OnDestroy {
  public url = `http://${window.location.hostname}:5000`;
  private timer?: ReturnType<typeof setTimeout>;
  publictransportdata = signal<any>(null);
  async getpublictransportdata(location : string) {
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

  async getPublicTransportSettings(): Promise<string> {
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

  async update() {
    let wait = 30_000;
    try {
      const data = await this.getpublictransportdata(await this.getPublicTransportSettings());
      this.publictransportdata.set(data);

      if (!data) {
        this.timer = setTimeout(() => this.update(), wait);
        return;
      }

      const now = Date.now();
      const nextDeparture = (data.stationboard ?? [])
        .map((s: any) => s.stop.departureTimestamp * 1000)
        .find((t: number) => t > now);

      if (nextDeparture) wait = Math.min(Math.max(nextDeparture - now, 10_000), 60_000);
    } catch (e) {
      console.error('Public transport fetch failed', e);
    }

    this.timer = setTimeout(() => this.update(), wait);
  }

  async ngOnInit() {
    this.update();
  }

  async ngOnDestroy() {
    clearTimeout(this.timer);
  }
}
