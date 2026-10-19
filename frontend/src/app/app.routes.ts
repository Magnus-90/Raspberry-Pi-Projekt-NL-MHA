import { Routes } from '@angular/router';
import { WeatherComponent } from './weather-component/weather-component';
import { TimeConponent } from './time-conponent/time-conponent';
export const routes: Routes = [
    {path: '', component: TimeConponent},
    {path: 'weather', component: WeatherComponent}
];
