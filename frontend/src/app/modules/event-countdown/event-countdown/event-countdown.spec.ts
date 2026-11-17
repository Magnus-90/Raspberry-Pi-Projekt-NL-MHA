import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EventCountdown } from './event-countdown';

describe('EventCountdown', () => {
  let component: EventCountdown;
  let fixture: ComponentFixture<EventCountdown>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EventCountdown],
    }).compileComponents();

    fixture = TestBed.createComponent(EventCountdown);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
