// Mock for next/navigation — required because nextstepjs imports it internally.
// This file is aliased via vite.config.ts so the import resolves here instead.

export const useRouter = () => ({
  push: (_path: string) => {},
  replace: (_path: string) => {},
  prefetch: (_path: string) => {},
  back: () => {},
  forward: () => {},
  refresh: () => {},
});

export const usePathname = () => window.location.pathname;

export const useSearchParams = () => new URLSearchParams(window.location.search);

export const useParams = () => ({} as Record<string, string>);
