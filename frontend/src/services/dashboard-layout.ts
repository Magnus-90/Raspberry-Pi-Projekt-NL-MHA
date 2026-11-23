import { Point } from '@angular/cdk/drag-drop';
import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';

export type Cells = Record<string, number>;
export type Area = {
  row: number,
  col: number,
  rowSpan: number,
  colSpan: number
}

const STORAGE_KEY = 'dashboard-cells';
const VERTICAL_KEY = 'dashboard-vertical';
const DEFAULT_CELLS: Record<string, number> = { 'time': 0, 'event': 1, 'weather': 2, 'public-transport': 3 };
const MODULE_ROUTES: Record<string, string> = { 'time': 'clock', 'event': 'event', 'weather': 'weather', 'public-transport': 'publictransport' };

@Injectable({
  providedIn: 'root',
})
export class DashboardLayout {
  private router = inject(Router);
  cells = signal<Record<string, number>>(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') ?? DEFAULT_CELLS);
  vertical = signal<boolean>(localStorage.getItem(VERTICAL_KEY) === 'true');
  dragging = signal<{ id: string, cell: number } | null>(null);

  area(id: string) {
    const dragging = this.dragging();
    if (dragging?.id === id) {
      return `${Math.floor(dragging.cell / 2) + 1} / ${dragging.cell % 2 + 1}`;
    }
    const a = this.areaOf(id, this.cells());
    return `${a.row + 1} / ${a.col + 1} / span ${a.rowSpan} / span ${a.colSpan}`;
  }

  dragStart(id: string, point: Point, rect: DOMRect) {
    this.dragging.set({ id, cell: this.cellAt(point, rect) });
  }

  drop(id: string, point: Point, rect: DOMRect) {
    this.dragging.set(null);
    const target = this.cellAt(point, rect);
    const cells = { ...this.cells() };

    const other = Object.keys(cells).find(key => key !== id && this.covers(this.areaOf(key, cells), target));
    if (other) {
      const rest = [0, 1, 2, 3].filter(cell => cell !== target && this.covers(this.areaOf(other, cells), cell));
      cells[other] = rest.length ? rest[0] : cells[id];
    }
    cells[id] = target;

    if (other) {
      const cell = cells[other];
      const colMate = (1 - Math.floor(cell / 2)) * 2 + cell % 2;
      this.vertical.set(!Object.values(cells).includes(colMate));
    }

    this.cells.set(cells);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cells));
    localStorage.setItem(VERTICAL_KEY, String(this.vertical()));
  }

  private areaOf(id: string, cells: Record<string, number>): Area {
    const taken = Object.values(cells);
    const cell = cells[id];
    const row = Math.floor(cell / 2);
    const col = cell % 2;
    const free = (c: number) => !taken.includes(c);

    let fullWidth: boolean;
    let fullHeight: boolean;
    if (this.vertical()) {
      fullHeight = free((1 - row) * 2 + col);
      fullWidth = free(1 - col) && free(2 + (1 - col));
    } else {
      fullWidth = free(row * 2 + (1 - col));
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

  private cellAt(point: Point, rect: DOMRect) {
    const col = point.x - rect.left < rect.width / 2 ? 0 : 1;
    const row = point.y - rect.top < rect.height / 2 ? 0 : 1;
    return row * 2 + col;
  }

}
