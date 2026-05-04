import { Metadata } from "@/app/pages/metadata";
import { MetadataProps } from "@twofold/framework/types";
import { ReactNode } from "react";

export async function metadata(props: MetadataProps): Promise<Metadata> {
  return {
    additionalBodyClassNames:
      props.searchParams.get("__white") !== null ? ["text-white"] : [],
  };
}

export default function NestedLayoutLevel2({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div>
      <span className="bg-red-500 px-1.5 py-1 text-white">Level 2</span>
      <div className="border border-red-500 p-4">{children}</div>
    </div>
  );
}
