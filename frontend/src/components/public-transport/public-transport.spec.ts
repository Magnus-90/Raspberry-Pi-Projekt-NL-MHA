import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PublicTransport } from './public-transport';

describe('PublicTransport', () => {
  let component: PublicTransport;
  let fixture: ComponentFixture<PublicTransport>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PublicTransport],
    }).compileComponents();

    fixture = TestBed.createComponent(PublicTransport);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
