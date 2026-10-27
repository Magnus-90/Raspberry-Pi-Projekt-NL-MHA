import { Component, OnInit, signal } from '@angular/core';

const WMO_ICONS: Record<number, [string, string]> = {
  0: ['clear-day', 'clear-night'],
  1: ['partly-cloudy-day', 'partly-cloudy-night'],
  2: ['partly-cloudy-day', 'partly-cloudy-night'],
  3: ['overcast', 'overcast'],
  45: ['fog-day', 'fog-night'],
  48: ['fog-day', 'fog-night'],
  51: ['drizzle', 'drizzle'],
  53: ['drizzle', 'drizzle'],
  55: ['drizzle', 'drizzle'],
  56: ['sleet', 'sleet'],
  57: ['sleet', 'sleet'],
  61: ['rain', 'rain'],
  63: ['rain', 'rain'],
  65: ['extreme-rain', 'extreme-rain'],
  66: ['sleet', 'sleet'],
  67: ['sleet', 'sleet'],
  71: ['snow', 'snow'],
  73: ['snow', 'snow'],
  75: ['extreme-snow', 'extreme-snow'],
  77: ['snow', 'snow'],
  80: ['partly-cloudy-day-rain', 'partly-cloudy-night-rain'],
  81: ['partly-cloudy-day-rain', 'partly-cloudy-night-rain'],
  82: ['extreme-rain', 'extreme-rain'],
  85: ['partly-cloudy-day-snow', 'partly-cloudy-night-snow'],
  86: ['extreme-snow', 'extreme-snow'],
  95: ['thunderstorms', 'thunderstorms'],
  96: ['hail', 'hail'],
  99: ['hail', 'hail'],
};

@Component({
  selector: 'app-weather',
  imports: [],
  templateUrl: './weather.html',
  styleUrl: './weather.scss',
})
export class WeatherComponent implements OnInit {
  weatherdata = signal<any>(null);
  async getCurrentWeahterData() {
    const response = await fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=47.3908&longitude=9.3864&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,daylight_duration,sunshine_duration&models=meteoswiss_icon_seamless&current=temperature_2m,weather_code,is_day&timezone=Europe%2FBerlin&forecast_days=1',
    );

    const data = await response.json();
    return data;
  }

  getIconPath(code: number, isDay: number): string {
    const entry = WMO_ICONS[code];
    if (!entry) return 'icons/not-available.svg';
    return `icons/${isDay ? entry[0] : entry[1]}.svg`;
  }

  async ngOnInit() {
    const data = await this.getCurrentWeahterData();
    console.log(data);
    this.weatherdata.set(data);
  }
}
