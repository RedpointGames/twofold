// these types are importable by the application

import type { ReactNode } from "react";
import { UserConfig } from "vite";

export type PageProps<T extends string | never = never> = {
  params: Record<T, string>;
  searchParams: URLSearchParams;
  url: URL;
  request: Request;
};

export type LayoutProps = {
  params: Record<string, string | undefined>;
  searchParams: URLSearchParams;
  url: URL;
  request: Request;
  children: ReactNode;
};

export type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export type APIProps<T extends string | never = never> = {
  params: Record<T, string>;
  searchParams: URLSearchParams;
  url: URL;
  request: Request;
};

export type Config = {
  experimental_viteConfig?: {
    dev?: UserConfig;
    build?: UserConfig;
    preview?: UserConfig;
  };
};
