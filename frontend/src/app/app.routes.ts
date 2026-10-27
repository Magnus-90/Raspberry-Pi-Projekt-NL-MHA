import { Routes } from '@angular/router';
import { Overview } from './overview/overview';
import { WeatherComponent } from './modules/weather/weather';
import { TimeConponent } from './modules/time/time';
import { PublicTransport } from './modules/public-transport/public-transport';
import { AdminComponent } from './modules/admin/admin-component';
export const routes: Routes = [
    {path: '', component: Overview},
    {path: 'clock', component: TimeConponent},
    {path: 'weather', component: WeatherComponent},
    {path: 'publictransport', component: PublicTransport},
    {path: 'admin', component: AdminComponent}
];
