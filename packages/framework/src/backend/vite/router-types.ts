import type { FunctionComponent } from "react";
import type { ReactFormState } from "react-dom/client";
import type {
  LayoutProps,
  MetadataProps,
  PageProps,
} from "../../types/importable";
import type { RscActionPayload } from "./entrypoint/payload";
import type { AuthPolicyArray } from "../auth/auth";

export enum MiddlewareMode {
  Run,
  Skip,
}

export interface ModuleSurface {
  default?: FunctionComponent<
    | LayoutProps
    | PageProps<any>
    | { error: unknown }
    | { unauthorizedMessage: string | undefined }
  >;
  auth?: AuthPolicyArray;
  before?: (props: any) => Promise<void>;
  GET?: (req: Request) => Promise<Response>;
  POST?: (req: Request) => Promise<Response>;
  [key: string | symbol]: any | undefined;
  metadata?:
    | object
    | ((props: MetadataProps<string, string | undefined>) => Promise<object>);
}

export type ModuleMap = {
  [path: string]: () => Promise<ModuleSurface>;
};

export class ActionResultData {
  returnValue: RscActionPayload | undefined;
  actionStatus: number | undefined;
  formState: ReactFormState | undefined;
  temporaryReferences: unknown | undefined;
  response: Response | undefined;
  error: unknown | undefined;
}
