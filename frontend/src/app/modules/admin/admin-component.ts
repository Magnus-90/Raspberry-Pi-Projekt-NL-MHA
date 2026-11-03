import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';

const TOKEN_KEY = 'admin-token';

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
  public password = signal("");
  private token = signal(sessionStorage.getItem(TOKEN_KEY) ?? "");
  public loggedIn = computed(() => this.token() !== "");
  private timer?: ReturnType<typeof setInterval>;

  private authHeaders() {
    return {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${this.token()}`
    };
  }

  logout(message = "") {
    sessionStorage.removeItem(TOKEN_KEY);
    this.token.set("");
    this.systemstats.set(null);
    this.info.set("");
    this.error.set(message);
  }

  async login(event: Event) {
    event.preventDefault();
    this.error.set("");
    try {
      const response = await fetch(`${this.url}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ "password": this.password() })
      });
      if (!response.ok) {
        this.error.set(response.status === 401 ? "Falsches Passwort" : `Login fehlgeschlagen: ${response.status}`);
        return;
      }
      const data = await response.json();
      sessionStorage.setItem(TOKEN_KEY, data.token);
      this.token.set(data.token);
      this.password.set("");
      await this.loadData();
    } catch (error) {
      this.error.set(`Login fehlgeschlagen: ${error}`);
    }
  }

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
        headers: this.authHeaders(),
        body: JSON.stringify ({
          "weatherlocation": this.weatherlocation(),
          "publictransportlocation": this.publictransportlocation(),
        })
      }
      )
      if(respone.status === 401){
        this.logout("Sitzung abgelaufen, bitte neu anmelden");
        return;
      }
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
        method: "POST",
        headers: this.authHeaders()
      })
      if(response.status === 401){
        this.logout("Sitzung abgelaufen, bitte neu anmelden");
        return;
      }
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

  private async loadData() {
    const settings = await this.getSettings()
    await this.getsystemStats();
    if (settings == undefined){
      return;
    }
    this.publictransportlocation.set(settings.publictransportlocation ?? "")
    this.weatherlocation.set(settings.weatherlocation ?? "")
  }

  async ngOnInit() {
    this.timer = setInterval(async () => {
      if (this.loggedIn()) {
        await this.getsystemStats();
      }
    }, 10000);
    if (this.loggedIn()) {
      await this.loadData();
    }
  }

  ngOnDestroy() {
    clearInterval(this.timer);
  }
}
