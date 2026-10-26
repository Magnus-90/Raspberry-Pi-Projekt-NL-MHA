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
  selector: 'app-weather-component',
  imports: [],
  templateUrl: './weather-component.html',
  styleUrl: './weather-component.scss',
})
export class WeatherComponent implements OnInit {
  public url = `http://${window.location.hostname}:5000`;
  weatherdata = signal<any>(null);
  async getCurrentWeahterData(latitude : any, longitude : any) {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,daylight_duration,sunshine_duration&models=meteoswiss_icon_seamless&current=temperature_2m,weather_code,is_day&timezone=Europe%2FBerlin&forecast_days=1`,
    );

    const data = await response.json();
    return data;
  }

  async getWeatherSettings(){
    const response = await fetch(`${this.url}/settings`, {
      method: "GET"
    })
    if(!response.ok){
      console.log("Fehler beim Wetter Settings laden")
      return ""
    }
    const data = await response.json()
    return data?.weatherlocation ?? ""
  }

  async convertWeatherLocation(name : string){
    const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en&format=json`, {
      method: "GET"
    })
    if(!response.ok){
      console.log("Geocoding fehlgeschlagen")
      return null
    }
    const data = await response.json()
    const place = data?.results?.[0];
    if (!place) {
      return null;
    }
    return { latitude: place.latitude, longitude: place.longitude };
  }

  getIconPath(code: number, isDay: number): string {
    const entry = WMO_ICONS[code];
    if (!entry) return 'icons/not-available.svg';
    return `icons/${isDay ? entry[0] : entry[1]}.svg`;
  }

  async ngOnInit() {
    try {
      const name = await this.getWeatherSettings();
      const coordinates = await this.convertWeatherLocation(name);
      if (!coordinates) {
        return;
      }
      const data = await this.getCurrentWeahterData(coordinates.latitude, coordinates.longitude);
      this.weatherdata.set(data);
    } catch (e) {
      console.error('Weather fetch failed', e);
    }
  }
}
