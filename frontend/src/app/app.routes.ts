import { Routes } from '@angular/router';
import { WeatherComponent } from '../components/weather-component/weather-component';
import { TimeConponent } from '../components/time-conponent/time-conponent';
import { PublicTransport } from '../components/public-transport/public-transport';
export const routes: Routes = [
    {path: '', redirectTo: 'clock', pathMatch: 'full'},
    {path: 'clock', component: TimeConponent},
    {path: 'weather', component: WeatherComponent},
    {path: 'publictransport', component: PublicTransport}
];
