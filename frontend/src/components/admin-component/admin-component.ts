import { Component, OnInit, signal } from '@angular/core';

@Component({
  selector: 'app-admin-component',
  imports: [],
  templateUrl: './admin-component.html',
  styleUrl: './admin-component.scss',
})
export class AdminComponent implements OnInit {
  private url = 'http://localhost:5000/health';
  public systemstats = signal<any>(null);
  async getsystemStats() {
    const response = await fetch(this.url);
    const data = await response.json();
    console.log(data);
    this.systemstats.set(data);
  }

  async ngOnInit() {
    setInterval(async () => {
      await this.getsystemStats();
    }, 10000);
  }
}
