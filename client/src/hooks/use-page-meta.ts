import { useEffect } from 'react';

interface PageMetaOptions {
  title: string;
  description?: string;
  noIndex?: boolean;
}

export function usePageMeta({ title, description, noIndex = false }: PageMetaOptions) {
  useEffect(() => {
    document.title = `${title} | Xucasa`;

    let robotsMeta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!robotsMeta) {
      robotsMeta = document.createElement('meta');
      robotsMeta.setAttribute('name', 'robots');
      document.head.appendChild(robotsMeta);
    }
    robotsMeta.setAttribute('content', noIndex ? 'noindex, nofollow' : 'index, follow');

    if (description) {
      let descMeta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
      if (!descMeta) {
        descMeta = document.createElement('meta');
        descMeta.setAttribute('name', 'description');
        document.head.appendChild(descMeta);
      }
      descMeta.setAttribute('content', description);
    }

    return () => {
      const rm = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
      if (rm) rm.setAttribute('content', 'index, follow');
    };
  }, [title, description, noIndex]);
}
