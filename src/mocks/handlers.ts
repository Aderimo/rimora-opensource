import { http, HttpResponse } from 'msw';

/**
 * MSW Request Handlers
 * Mock API responses for testing
 */

export const handlers = [
  // TMDB API Mocks
  http.get('/api/tmdb/movie/:id', ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      title: 'Test Movie',
      overview: 'Test movie overview',
      poster_path: '/test-poster.jpg',
      backdrop_path: '/test-backdrop.jpg',
      vote_average: 8.5,
      release_date: '2024-01-01',
    });
  }),

  http.get('/api/tmdb/tv/:id', ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      name: 'Test TV Show',
      overview: 'Test TV show overview',
      poster_path: '/test-poster.jpg',
      backdrop_path: '/test-backdrop.jpg',
      vote_average: 8.0,
      first_air_date: '2024-01-01',
    });
  }),

  // Payment API Mocks
  http.post('/api/payment/create-session', async () => {
    return HttpResponse.json({
      success: true,
      checkoutFormContent: '<div>Mock Checkout Form</div>',
      token: 'mock-payment-token',
    });
  }),

  http.post('/api/payment/webhook', async () => {
    return HttpResponse.json({
      success: true,
      message: 'Webhook processed',
    });
  }),

  // Subtitles API Mocks
  http.get('/api/subtitles/search', ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('query');
    
    return HttpResponse.json({
      data: [
        {
          id: '1',
          attributes: {
            files: [
              {
                file_id: 1,
                file_name: `${query}-subtitle.srt`,
              },
            ],
            language: 'tr',
            download_count: 1000,
          },
        },
      ],
    });
  }),

  // Notifications API Mocks
  http.post('/api/notifications/send', async () => {
    return HttpResponse.json({
      success: true,
      messageId: 'mock-message-id',
    });
  }),

  // Email API Mocks
  http.post('/api/email/welcome', async () => {
    return HttpResponse.json({
      success: true,
      id: 'mock-email-id',
    });
  }),

  http.post('/api/email/subscription', async () => {
    return HttpResponse.json({
      success: true,
      id: 'mock-email-id',
    });
  }),

  // Stats API Mocks
  http.post('/api/stats/calculate', async () => {
    return HttpResponse.json({
      success: true,
      stats: {
        totalWatchTime: 3600,
        moviesWatched: 10,
        tvShowsWatched: 5,
      },
    });
  }),

  // Search API Mocks
  http.get('/api/search', ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('q');
    
    return HttpResponse.json({
      results: [
        {
          id: 1,
          title: `Result for ${query}`,
          media_type: 'movie',
          poster_path: '/test-poster.jpg',
        },
      ],
    });
  }),
];
