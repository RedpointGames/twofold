import { RewriteProps } from "@twofold/framework/types";

export default async function rewrite(props: RewriteProps) {
  // Rewrite to dynamic route.
  return "../dynamic/nested/hello/blah";
}
