import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    title: 'Recent plays',
    loadComponent: () => import('./pages/recent-plays/recent-plays').then((m) => m.RecentPlays),
  },
  {
    path: 'artists',
    title: 'Top artists',
    loadComponent: () => import('./pages/artists/artists').then((m) => m.Artists),
  },
  {
    path: 'artist/:name',
    title: 'Artist',
    loadComponent: () => import('./pages/artist-detail/artist-detail').then((m) => m.ArtistDetail),
  },
  {
    path: 'search',
    title: 'Search',
    loadComponent: () => import('./pages/search/search').then((m) => m.Search),
  },
  {
    path: 'playlist',
    title: 'Mixtape',
    loadComponent: () =>
      import('./pages/playlist-builder/playlist-builder').then((m) => m.PlaylistBuilder),
  },
  { path: '**', redirectTo: '' },
];
