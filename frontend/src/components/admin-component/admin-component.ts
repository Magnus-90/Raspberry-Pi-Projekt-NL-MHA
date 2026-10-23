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
  public publictransportlocation = signal("");
  public weatherlocation = signal("");
  public error = signal("");
  async getsystemStats() {
    const response = await fetch(this.url);
    const data = await response.json();
    console.log(data);
    this.systemstats.set(data);
  }

  async saveSettings(){
    try{
      const respone = await fetch("http://localhost:5000/settings",
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

  async updatePi(){
    const respone = await fetch("http://localhost:5000/update", {
      method: "POST"
    })
    return respone;
  }

  async restartPi(){
    if(!confirm("Sind sie sich sicher das sie den Raspberry Pi neu Starten möchten?")){
      return;
    }
    const respone = await fetch("http://localhost:5000/restart",{
      method: "POST"
    })
    return respone;
  }

  async ngOnInit() {
    setInterval(async () => {
      await this.getsystemStats();
    }, 10000);
  }
}
