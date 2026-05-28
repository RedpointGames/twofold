import { RewriteProps } from "@twofold/framework/types";

export default async function rewrite(props: RewriteProps<"extra">) {
  // Rewrite to dynamic route.
  return `/routing/rewrites-target/${props.params.extra}/nested`;
}
