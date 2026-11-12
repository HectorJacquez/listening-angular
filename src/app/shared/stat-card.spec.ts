import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StatCard } from './stat-card';

@Component({
  imports: [StatCard],
  template: `<app-stat-card [value]="'1,234'" label="plays" [note]="note" />`,
})
class Host {
  note?: string;
}

describe('StatCard', () => {
  it('renders the value and label', async () => {
    const f = TestBed.createComponent(Host);
    await f.whenStable();
    const text = f.nativeElement.textContent;
    expect(text).toContain('1,234');
    expect(text).toContain('plays');
    expect(f.nativeElement.querySelector('.stat-note')).toBeNull();
  });

  it('shows the note only when given', async () => {
    const f = TestBed.createComponent(Host);
    f.componentInstance.note = 'all time';
    f.changeDetectorRef.markForCheck();
    await f.whenStable();
    expect(f.nativeElement.querySelector('.stat-note')?.textContent).toContain('all time');
  });
});
