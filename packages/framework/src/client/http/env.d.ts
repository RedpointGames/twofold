export type Env = {
  keys: () => string[];
} & {
  readonly [key: string]: string | undefined;
};

export const env: Env;
