import { Routes } from '@angular/router';
import { Overview } from './overview/overview';
import { WeatherComponent } from './modules/weather/weather';
import { TimeConponent } from './modules/time/time';
import { PublicTransport } from './modules/public-transport/public-transport';
import { AdminComponent } from './modules/admin/admin-component';
import { EventCountdown } from './modules/event-countdown/event-countdown/event-countdown';
export const routes: Routes = [
    {path: '', component: Overview},
    {path: 'clock', component: TimeConponent},
    {path: 'weather', component: WeatherComponent},
    {path: 'publictransport', component: PublicTransport},
    {path: 'event', component: EventCountdown},
    {path: 'admin', component: AdminComponent}
];
