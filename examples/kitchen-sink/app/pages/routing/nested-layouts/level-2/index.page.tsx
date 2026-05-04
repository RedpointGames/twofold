import { Metadata } from "@/app/pages/metadata";
import Link from "@twofold/framework/link";
import { MetadataProps } from "@twofold/framework/types";

export async function metadata(props: MetadataProps): Promise<Metadata> {
  return {
    additionalBodyClassNames:
      props.searchParams.get("__italic") !== null ? ["italic"] : [],
  };
}

export default function Page() {
  return <Link href="/routing/nested-layouts">Go back</Link>;
}
