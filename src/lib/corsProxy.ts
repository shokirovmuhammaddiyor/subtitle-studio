export interface CorsProxy {
  id: string;
  name: string;
  urlPattern: (targetUrl: string) => string;
}

export const CORS_PROXIES: CorsProxy[] = [
  {
    id: 'corsproxy_io',
    name: 'CORSProxy.io (Tavsiya etiladi - Range qo\'llab-quvvatlaydi)',
    urlPattern: (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  },
  {
    id: 'corsproxy_org',
    name: 'CORSProxy.org (Muqobil)',
    urlPattern: (url) => `https://corsproxy.org/?${encodeURIComponent(url)}`,
  },
  {
    id: 'corsfix',
    name: 'CorsFix Proxy',
    urlPattern: (url) => `https://proxy.corsfix.com/?${encodeURIComponent(url)}`,
  },
  {
    id: 'direct',
    name: 'To\'g\'ridan-to\'g\'ri (Direct - agar CORS ruxsat etilgan bo\'lsa)',
    urlPattern: (url) => url,
  },
];

export function buildProxiedUrl(rawUrl: string, proxyId: string, customProxyUrl?: string): string {
  if (!rawUrl) return '';
  if (proxyId === 'custom' && customProxyUrl) {
    if (customProxyUrl.includes('{url}')) {
      return customProxyUrl.replace('{url}', encodeURIComponent(rawUrl));
    }
    return `${customProxyUrl.replace(/\/+$/, '')}/${encodeURIComponent(rawUrl)}`;
  }
  const proxy = CORS_PROXIES.find(p => p.id === proxyId) || CORS_PROXIES[0];
  return proxy.urlPattern(rawUrl);
}
