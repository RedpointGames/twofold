// these types are importable by the application

import type { ReactNode } from "react";
import { UserConfig } from "vite";

export type MetadataProps<
  T extends string | never = never,
  TV = string | undefined,
> = {
  params: Record<T, TV>;
  request: Request;
  searchParams: URLSearchParams;
  url: URL;
  rewrittenTo: {
    searchParams: URLSearchParams;
    url: URL;
  };
  original: {
    searchParams: URLSearchParams;
    url: URL;
  };
};

export type PageProps<
  T extends string | never = never,
  M extends object | never = never,
> = MetadataProps<T, string> & {
  metadata: M;
};

export type LayoutProps<M extends object | never = never> = MetadataProps<
  string,
  string | undefined
> & {
  children: ReactNode;
  metadata: M;
};

export type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export type APIProps<
  T extends string | never = never,
  M extends object | never = never,
> = MetadataProps<T, string> & {
  metadata: M;
};

export type RewriteProps<T extends string | never = never> = MetadataProps<
  T,
  string
> & {
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
