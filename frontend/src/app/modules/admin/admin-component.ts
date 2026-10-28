import { Component, OnDestroy, OnInit, signal } from '@angular/core';

@Component({
  selector: 'app-admin-component',
  imports: [],
  templateUrl: './admin-component.html',
  styleUrl: './admin-component.scss',
})
export class AdminComponent implements OnInit, OnDestroy {
  private url = `http://${window.location.hostname}:5000`;
  public systemstats = signal<any>(null);
  public publictransportlocation = signal("");
  public weatherlocation = signal("");
  public error = signal("");
  public info = signal("");
  private timer?: ReturnType<typeof setInterval>;
  
  async getsystemStats() {
    try{
      const response = await fetch(`${this.url}/health`);
      if(!response.ok){
        this.error.set(`Fehler beim laden der Systeminformationen: ${response.status}`);
        return;
      }
      const data = await response.json();
      this.systemstats.set(data);
      this.error.set("");
    } catch (error) {
      this.error.set(`Fehler beim laden der Systeminformationen: ${error}`)
    }
  }

  async saveSettings(){
    try{
      const respone = await fetch(`${this.url}/settings`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify ({
          "weatherlocation": this.weatherlocation(),
          "publictransportlocation": this.publictransportlocation(),
        })
      }
      )
      if(!respone.ok){
        this.error.set(`Fehler beim Speichern: ${respone.status}`)
      }
    } catch (error){
      this.error.set(`Fehler beim Speichern: ${error}`)
    }
  }

  private async sendCommand(path: string, label: string){
    this.error.set("");
    this.info.set("");
    try{
      const response = await fetch(`${this.url}/${path}`, {
        method: "POST"
      })
      if(!response.ok){
        this.error.set(`${label} fehlgeschlagen: ${response.status}`);
        return;
      }
      this.info.set(`${label} gestartet`);
    } catch (error){
      this.error.set(`${label} fehlgeschlagen: ${error}`);
    }
  }

  async updatePi(){
    await this.sendCommand("update", "Update");
  }

  async restartPi(){
    if(!confirm("Sind sie sich sicher das sie den Raspberry Pi neu Starten möchten?")){
      return;
    }
    await this.sendCommand("restart", "Neustart");
  }

  async getSettings(){
    try{
      const response = await fetch(`${this.url}/settings`,{
      method: "GET"
      })
      if(!response.ok){
        this.error.set(`Fehler beim Settings Laden: ${response.status}`);
        return;
      }
      const data = await response.json()
      return data;
    } catch (error){
      this.error.set(`Fehler beim Settings Laden: ${error}`)
    }
  }

  async ngOnInit() {
    this.timer = setInterval(async () => {
      await this.getsystemStats();
    }, 10000);
    const settings = await this.getSettings()
    await this.getsystemStats();
    if (settings == undefined){
      return;
    }
    this.publictransportlocation.set(settings.publictransportlocation ?? "")
    this.weatherlocation.set(settings.weatherlocation ?? "")
  }

  ngOnDestroy() {
    clearInterval(this.timer);
  }
}
