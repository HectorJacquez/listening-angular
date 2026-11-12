import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PreviewButton } from './preview-button';
import { PreviewPlayer } from './preview-player';

@Component({ imports: [PreviewButton], template: `<app-preview-button [url]="url" />` })
class Host {
  url: string | null = 'https://p/clip.m4a';
}

describe('PreviewButton', () => {
  it('labels the clip as 30 seconds, and counts down while it plays', async () => {
    const f = TestBed.createComponent(Host);
    await f.whenStable();
    expect(f.nativeElement.querySelector('.clock').textContent.trim()).toBe('30s');
    const player = TestBed.inject(PreviewPlayer);
    player.current.set('https://p/clip.m4a');
    player.position.set(12);
    await f.whenStable();
    expect(f.nativeElement.querySelector('.clock').textContent.trim()).toBe('0:12 / 0:30');
    expect(f.nativeElement.querySelector('button').textContent.trim()).toBe('■');
  });

  it('renders nothing without a preview', async () => {
    const f = TestBed.createComponent(Host);
    f.componentInstance.url = null;
    await f.whenStable();
    expect(f.nativeElement.querySelector('button')).toBeNull();
  });
});
