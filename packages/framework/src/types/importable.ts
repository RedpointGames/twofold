// these types are importable by the application

import type { ReactNode } from "react";
import { UserConfig } from "vite";

export type MetadataProps<
  T extends string | never = never,
  TV = string | undefined,
> = {
  params: Record<T, TV>;
  searchParams: URLSearchParams;
  url: URL;
  request: Request;
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

export type Config = {
  experimental_viteConfig?: {
    dev?: UserConfig;
    build?: UserConfig;
    preview?: UserConfig;
  };
};
