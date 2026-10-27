import { Component, OnInit, signal } from '@angular/core';

@Component({
  selector: 'app-admin-component',
  imports: [],
  templateUrl: './admin-component.html',
  styleUrl: './admin-component.scss',
})
export class AdminComponent implements OnInit {
  private url = `http://${window.location.hostname}:5000`;
  public systemstats = signal<any>(null);
  public publictransportlocation = signal("");
  public weatherlocation = signal("");
  public error = signal("");
  public info = signal("");
  async getsystemStats() {
    const response = await fetch(`${this.url}/health`);
    const data = await response.json();
    console.log(data);
    this.systemstats.set(data);
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

  async ngOnInit() {
    setInterval(async () => {
      await this.getsystemStats();
    }, 10000);
  }
}
