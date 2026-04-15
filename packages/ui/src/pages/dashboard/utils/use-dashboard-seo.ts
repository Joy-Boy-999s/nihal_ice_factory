import { useEffect } from 'react';

interface DashboardSeoOptions {
  title: string;
  description: string;
}

export const useDashboardSeo = ({ title, description }: DashboardSeoOptions): void => {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title;

    const existing = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const metaCreated = !existing;
    const meta = existing ?? document.createElement('meta');
    if (!existing) {
      meta.name = 'description';
      document.head.appendChild(meta);
    }
    const previousDescription = meta.content;
    meta.content = description;

    return () => {
      document.title = previousTitle;
      if (metaCreated) {
        meta.remove();
      } else {
        meta.content = previousDescription;
      }
    };
  }, [title, description]);
};
