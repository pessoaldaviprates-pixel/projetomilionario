import type { MetadataRoute } from 'next';

/** Manifesto PWA — permite instalar a Nexora como aplicativo. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Nexora — Pessoas + Processos + Resultados',
    short_name: 'Nexora',
    description:
      'Comunicação, tarefas, projetos, reuniões, agenda e inteligência artificial em um único ambiente corporativo.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#05070D',
    theme_color: '#05070D',
    lang: 'pt-BR',
    orientation: 'portrait-primary',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
