import { Component, input, output } from '@angular/core';
import { CdkDrag, CdkDragEnd, CdkDragHandle, CdkDragStart, Point } from '@angular/cdk/drag-drop';

@Component({
  selector: 'app-panel',
  imports: [
    CdkDrag,
    CdkDragHandle
  ],
  templateUrl: './panel.html',
  styleUrl: './panel.scss',
})
export class Panel {
  title = input<string>()
  dragStarted = output<Point>()
  dropped = output<Point>()
  opened = output<void>()

  private pressedAt: Point = { x: 0, y: 0 }

  onPointerDown(event: PointerEvent) {
    this.pressedAt = { x: event.clientX, y: event.clientY }
  }

  onDragStarted(event: CdkDragStart) {
    const pointer = 'touches' in event.event ? event.event.touches[0] : event.event
    this.dragStarted.emit({ x: pointer.clientX, y: pointer.clientY })
  }

  onDragEnded(event: CdkDragEnd) {
    this.dropped.emit(event.dropPoint)
    // Verschiebung zurücksetzen, die neue Position kommt über das Grid
    event.source.reset()
  }

  onClick(event: MouseEvent) {
    // Der Browser feuert auch nach Ziehen oder Wischen ein click, nur ein Klick ohne Bewegung öffnet das Modul
    const moved = Math.hypot(event.clientX - this.pressedAt.x, event.clientY - this.pressedAt.y)
    if (moved < 5) this.opened.emit()
  }
}
