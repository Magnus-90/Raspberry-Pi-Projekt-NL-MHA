import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
@Component({
  selector: 'app-public-transport',
  imports: [DatePipe],
  templateUrl: './public-transport.html',
  styleUrl: './public-transport.scss',
})
export class PublicTransport implements OnInit, OnDestroy {
  public location = 'Teufen AR';
  private timer?: ReturnType<typeof setTimeout>;
  publictransportdata = signal<any>(null);
  async getpublictransportdata() {
    const response = await fetch(
      `https://transport.opendata.ch/v1/stationboard?station=${this.location}&limit=10`,
    );
    const data = await response.json();
    console.log(data);
    return data;
  }

  async update() {
    const data = await this.getpublictransportdata();
    this.publictransportdata.set(data);

    const now = Date.now();
    const nextDeparture = data.stationboard
      .map((s: any) => s.stop.departureTimestamp * 1000)
      .find((t: number) => t > now);

    const wait = nextDeparture ? Math.min(Math.max(nextDeparture - now, 10_000), 60_000) : 30_000;

    this.timer = setTimeout(() => this.update(), wait);
  }

  async ngOnInit() {
    this.update();
  }

  async ngOnDestroy() {
    clearTimeout(this.timer);
  }
}
