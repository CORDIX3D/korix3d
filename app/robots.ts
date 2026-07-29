import type { MetadataRoute } from 'next';

const SITE_URL = 'https://korix3d.pl';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin/',
        '/panel/',
        '/api/',
        '/auth/',
        '/logowanie',
        '/rejestracja',
        '/odzyskaj-haslo',
        '/reset-password',
        '/koszyk',
        '/checkout',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
