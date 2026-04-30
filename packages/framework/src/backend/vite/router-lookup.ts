import builtServerReferences from "virtual:twofold/server-references-meta-map";
import builtClientReferences from "virtual:twofold/client-references-meta-map";
import { ModuleSurface } from "./router-types";

interface ServerActionMetadata {
  loadModule: () => Promise<ModuleSurface>;
  appPath: string;
}

interface ClientAssetMetadata {
  appPath: string;
}

export async function lookupServerActionMetadata(
  id: string,
): Promise<ServerActionMetadata | undefined> {
  id = id.split("#")[0]!;
  if (!import.meta.env.__vite_rsc_build__) {
    return (
      await import(
        /* @vite-ignore */
        `/@id/__x00__virtual:twofold/server-references-meta-map-lookup?id=${encodeURIComponent(id)}&lang.js`
      )
    ).default;
  } else {
    return builtServerReferences[id];
  }
}

export async function lookupClientAssetMetadata(
  idPrefixOnly: string,
): Promise<ClientAssetMetadata | undefined> {
  if (!import.meta.env.__vite_rsc_build__) {
    throw new Error("lookupClientAssetMetadata is not supported in dev");
  } else {
    return builtClientReferences[idPrefixOnly];
  }
}
