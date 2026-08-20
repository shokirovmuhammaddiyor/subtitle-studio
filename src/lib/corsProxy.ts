export interface CorsProxy {
  id: string;
  name: string;
  urlPattern: (targetUrl: string) => string;
}

export const CORS_PROXIES: CorsProxy[] = [
  {
    id: 'cf_worker_official',
    name: 'Cloudflare Worker (Rasmiy & Ultra-Tezkor - 100% Ishlaydi)',
    urlPattern: (url) => `https://subtitle-cors-proxy.muhammaddiyor-shokirov.workers.dev/?url=${encodeURIComponent(url)}`,
  },
  {
    id: 'corsproxy_io',
    name: 'CORSProxy.io',
    urlPattern: (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
  },
  {
    id: 'direct',
    name: 'To\'g\'ridan-to\'g\'ri (Direct - Agar CORS ruxsat etilgan bo\'lsa)',
    urlPattern: (url) => url,
  },
];

export function buildProxiedUrl(rawUrl: string, proxyId: string, customProxyUrl?: string): string {
  if (!rawUrl) return '';
  if (proxyId === 'custom' && customProxyUrl) {
    if (customProxyUrl.includes('{url}')) {
      return customProxyUrl.replace('{url}', encodeURIComponent(rawUrl));
    }
    return `${customProxyUrl.replace(/\/+$/, '')}/?url=${encodeURIComponent(rawUrl)}`;
  }
  const proxy = CORS_PROXIES.find(p => p.id === proxyId) || CORS_PROXIES[0];
  return proxy.urlPattern(rawUrl);
}
