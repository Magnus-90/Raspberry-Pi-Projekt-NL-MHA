import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Point } from '@angular/cdk/drag-drop';
import { Panel } from '../shared/panel/panel';
import { WeatherComponent } from '../modules/weather/weather';
import { TimeConponent } from '../modules/time/time';
import { PublicTransport } from '../modules/public-transport/public-transport';

const STORAGE_KEY = 'dashboard-cells';
const VERTICAL_KEY = 'dashboard-vertical';

// Felder: 0 = oben links, 1 = oben rechts, 2 = unten links, 3 = unten rechts
const DEFAULT_CELLS: Record<string, number> = { 'time': 0, 'weather': 2, 'public-transport': 3 };

// Route, auf der das Modul im Vollbild läuft (siehe app.routes.ts)
const MODULE_ROUTES: Record<string, string> = { 'time': 'clock', 'weather': 'weather', 'public-transport': 'publictransport' };

interface Area {
  row: number,
  col: number,
  rowSpan: number,
  colSpan: number
}

@Component({
  selector: 'app-overview',
  imports: [
    Panel,
    WeatherComponent,
    TimeConponent,
    PublicTransport
  ],
  templateUrl: './overview.html',
  styleUrl: './overview.scss',
})
export class Overview {
  private router = inject(Router);
  private dashboard = viewChild.required<ElementRef<HTMLElement>>('dashboard');
  cells = signal<Record<string, number>>(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') ?? DEFAULT_CELLS);
  // false = freie Felder werden zuerst in der Zeile gefüllt, true = zuerst in der Spalte
  vertical = signal<boolean>(localStorage.getItem(VERTICAL_KEY) === 'true');
  dragging = signal<{ id: string, cell: number } | null>(null);

  area(id: string) {
    const dragging = this.dragging();
    if (dragging?.id === id) {
      // Beim Ziehen nur das Viertel unter der Maus belegen
      return `${Math.floor(dragging.cell / 2) + 1} / ${dragging.cell % 2 + 1}`;
    }
    const a = this.areaOf(id, this.cells());
    return `${a.row + 1} / ${a.col + 1} / span ${a.rowSpan} / span ${a.colSpan}`;
  }

  open(id: string) {
    this.router.navigate([MODULE_ROUTES[id]]);
  }

  dragStart(id: string, point: Point) {
    this.dragging.set({ id, cell: this.cellAt(point) });
  }

  drop(id: string, point: Point) {
    this.dragging.set(null);
    const target = this.cellAt(point);
    const cells = { ...this.cells() };

    // Welches andere Modul belegt das Zielfeld sichtbar (auch wenn es nur hineingewachsen ist)?
    const other = Object.keys(cells).find(key => key !== id && this.covers(this.areaOf(key, cells), target));
    if (other) {
      const rest = [0, 1, 2, 3].filter(cell => cell !== target && this.covers(this.areaOf(other, cells), cell));
      // Belegt es mehrere Felder, behält es den Rest, sonst tauschen die beiden
      cells[other] = rest.length ? rest[0] : cells[id];
    }
    cells[id] = target;

    if (other) {
      // Das verdrängte Modul soll in ein frei gewordenes Feld darunter/darüber wachsen dürfen
      const cell = cells[other];
      const colMate = (1 - Math.floor(cell / 2)) * 2 + cell % 2;
      this.vertical.set(!Object.values(cells).includes(colMate));
    }

    this.cells.set(cells);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cells));
    localStorage.setItem(VERTICAL_KEY, String(this.vertical()));
  }

  // Berechnet die Fläche eines Moduls, es wächst in freie Felder hinein
  private areaOf(id: string, cells: Record<string, number>): Area {
    const taken = Object.values(cells);
    const cell = cells[id];
    const row = Math.floor(cell / 2);
    const col = cell % 2;
    const free = (c: number) => !taken.includes(c);

    let fullWidth: boolean;
    let fullHeight: boolean;
    if (this.vertical()) {
      // Zuerst die Spalte: kein Nachbar darunter/darüber -> volle Höhe
      fullHeight = free((1 - row) * 2 + col);
      // Volle Breite nur, wenn die andere Spalte komplett leer ist, sonst gäbe es Überlappungen
      fullWidth = free(1 - col) && free(2 + (1 - col));
    } else {
      // Zuerst die Zeile: kein Nachbar daneben -> volle Breite
      fullWidth = free(row * 2 + (1 - col));
      // Volle Höhe nur, wenn die andere Zeile komplett leer ist
      fullHeight = free((1 - row) * 2) && free((1 - row) * 2 + 1);
    }

    return {
      row: fullHeight ? 0 : row,
      col: fullWidth ? 0 : col,
      rowSpan: fullHeight ? 2 : 1,
      colSpan: fullWidth ? 2 : 1,
    };
  }

  private covers(area: Area, cell: number) {
    const row = Math.floor(cell / 2);
    const col = cell % 2;
    return row >= area.row && row < area.row + area.rowSpan && col >= area.col && col < area.col + area.colSpan;
  }

  private cellAt(point: Point) {
    const rect = this.dashboard().nativeElement.getBoundingClientRect();
    const col = point.x - rect.left < rect.width / 2 ? 0 : 1;
    const row = point.y - rect.top < rect.height / 2 ? 0 : 1;
    return row * 2 + col;
  }
}
