import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TimeConponent } from './time';

describe('TimeConponent', () => {
  let component: TimeConponent;
  let fixture: ComponentFixture<TimeConponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TimeConponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TimeConponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
