export interface CorsProxy {
  id: string;
  name: string;
  urlPattern: (targetUrl: string) => string;
}

export const CORS_PROXIES: CorsProxy[] = [
  {
    id: 'direct',
    name: 'To\'g\'ridan-to\'g\'ri (Direct - agar CORS ruxsat etilgan bo\'lsa)',
    urlPattern: (url) => url,
  },
  {
    id: 'corsproxy_io',
    name: 'CORSProxy.io (Tezkor va barqaror)',
    urlPattern: (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  },
  {
    id: 'allorigins',
    name: 'AllOrigins.win (Range requestlar bilan)',
    urlPattern: (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  },
  {
    id: 'codetabs',
    name: 'CodeTabs Proxy',
    urlPattern: (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
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
