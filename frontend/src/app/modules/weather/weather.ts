import { DatePipe } from '@angular/common';
import { booleanAttribute, Component, effect, ElementRef, input, OnDestroy, OnInit, signal, viewChild } from '@angular/core';
import {
  CategoryScale, Chart, LinearScale, LineController, LineElement,
  PointElement, Plugin, Title, Tooltip,
} from 'chart.js';

Chart.register(LineController, LineElement, PointElement, CategoryScale, LinearScale, Title, Tooltip);

const cq = (chart: Chart, w: number, h: number) =>
  Math.round(Math.min((chart.width * w) / 100, (chart.height * h) / 100));

function applyFontSizes(chart: Chart) {
  const options = chart.options as any;
  const label = cq(chart, 2.2, 6.8);
  const tick = cq(chart, 2, 6);
  options.plugins.title.font = { size: cq(chart, 3.2, 10), weight: 'bold' };
  options.scales.x.title.font = { size: label };
  options.scales.y.title.font = { size: label };
  options.scales.x.ticks.font = { size: tick };
  options.scales.y.ticks.font = { size: tick };
  options.layout.padding = { top: label + 8 };
}

const valueLabels: Plugin<'line'> = {
  id: 'valueLabels',
  afterDatasetsDraw(chart) {
    const ctx = chart.ctx;
    const values = chart.data.datasets[0].data as number[];
    ctx.save();
    ctx.font = `${cq(chart, 2.2, 6.8)}px sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    chart.getDatasetMeta(0).data.forEach((point, i) => {
      ctx.fillText(`${values[i]}°`, point.x, point.y - 8);
    });
    ctx.restore();
  },
};

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
  imports: [DatePipe],
  templateUrl: './weather.html',
  styleUrl: './weather.scss',
})
export class WeatherComponent implements OnInit, OnDestroy {
  public url = `http://${window.location.hostname}:5000`;
  private timer?: ReturnType<typeof setInterval>;
  weatherdata = signal<any>(null);
  cityname = signal("");
  error = signal("");
  detail = input(false, { transform: booleanAttribute });
  canvas = viewChild<ElementRef<HTMLCanvasElement>>('chartCanvas');
private chart?: Chart;

constructor() {
  // läuft, sobald das Canvas im DOM ist oder sich die Wetterdaten ändern
  effect(() => {
    const canvasRef = this.canvas();
    const data = this.weatherdata();
    if (!canvasRef || !data) {
      this.chart?.destroy();
      this.chart = undefined;
      return;
    }
    this.renderChart(canvasRef.nativeElement, data);
  });
}

private renderChart(canvas: HTMLCanvasElement, data: any) {
  const labels: string[] = data.hourly.time.map((t: string) => t.substring(11, 16));
  const temps: number[] = data.hourly.temperature_2m;

  if (this.chart && this.chart.canvas === canvas) {
    this.chart.data.labels = labels;
    this.chart.data.datasets[0].data = temps;
    this.chart.update();
    return;
  }

  this.chart?.destroy();
  this.chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: temps,
        label: 'Temperatur',
        borderColor: '#ffffff',
        backgroundColor: '#ff3535',
        tension: 0.2,
        pointRadius: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      // Schriftgrössen und Abstand setzt applyFontSizes, sobald die Grösse bekannt ist
      onResize: (chart) => applyFontSizes(chart),
      layout: { padding: { top: 20 } },
      plugins: {
        legend: { display: false },
        title: { display: true, text: 'Temperaturverlauf heute', align: 'center', color: '#ffffff' },
      },
      scales: {
        x: {
          title: { display: true, text: 'Uhrzeit', color: '#ffffff' },
          ticks: { color: '#ffffff' },
          grid: { color: 'rgba(255, 255, 255, 0.15)' },
        },
        y: {
          title: { display: true, text: 'Temperatur (°C)', color: '#ffffff' },
          ticks: { color: '#ffffff' },
          grid: { color: 'rgba(255, 255, 255, 0.15)' },
        },
      },
    },
    plugins: [valueLabels],
  });
}
  async getCurrentWeahterData(latitude : any, longitude : any) {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,daylight_duration,sunshine_duration&hourly=temperature_2m&models=meteoswiss_icon_seamless&current=temperature_2m,weather_code,is_day&timezone=Europe%2FBerlin&forecast_days=1`,
    );

    if(!response.ok){
      throw new Error(`Open-Meteo antwortet mit ${response.status}`);
    }

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
    const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en&format=json&countryCode=CH`, {
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

  async loadWeatherData(){
    try {
      this.cityname.set(await this.getWeatherSettings()); 
      const coordinates = await this.convertWeatherLocation(this.cityname());
      if (!coordinates) {
        return;
      }
      const data = await this.getCurrentWeahterData(coordinates.latitude, coordinates.longitude);
      this.weatherdata.set(data);
      this.error.set("");
    } catch (e) {
      console.error('Weather fetch failed', e);
      this.error.set("Wetterdaten konnten nicht geladen werden");
    }
  }

  async ngOnInit() {
    this.loadWeatherData();
    this.timer = setInterval(async () => {
      this.loadWeatherData();
    }, 600000);
  }

  ngOnDestroy() {
    clearInterval(this.timer);
    this.chart?.destroy();
  }
}
