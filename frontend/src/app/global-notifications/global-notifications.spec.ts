import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GlobalNotifications } from './global-notifications';

describe('GlobalNotifications', () => {
  let component: GlobalNotifications;
  let fixture: ComponentFixture<GlobalNotifications>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GlobalNotifications],
    }).compileComponents();

    fixture = TestBed.createComponent(GlobalNotifications);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
