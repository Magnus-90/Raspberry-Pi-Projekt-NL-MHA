import { TestBed } from '@angular/core/testing';

import { DashboardLayout } from './dashboard-layout';

describe('DashboardLayout', () => {
  let service: DashboardLayout;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DashboardLayout);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
