import { LayoutProps } from "@twofold/framework/types";

export default async function RootLayout(props: LayoutProps) {
  return <div>{props.children}</div>;
}
