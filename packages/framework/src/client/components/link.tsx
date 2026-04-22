"use client";

import {
  ComponentProps,
  ElementType,
  MouseEvent,
  ReactNode,
  Ref,
  useTransition,
} from "react";
import { useRouter } from "../hooks/use-router";
import { useProgress } from "react-transition-progress";

type Props<C extends ElementType> = {
  as?: C;
  ref?: Ref<HTMLAnchorElement>;
  href: string;
  replace?: boolean;
  scroll?: "top" | "preserve";
  mask?: string;
  children?: ReactNode;
} & ComponentProps<C>;

export default function Link<T extends ElementType = "a">({
  as,
  href,
  children,
  replace,
  scroll,
  mask,
  onClick,
  ref,
  ...props
}: Props<T>) {
  let router = useRouter();
  let using: "replace" | "navigate" = replace ? "replace" : "navigate";
  let shouldScroll = !scroll || scroll == "top";

  const startProgress = useProgress();
  const [isTransitioning, startTransition] = useTransition();

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    if (onClick) {
      onClick(e);
    }

    let isLocal = isLocalLink(href);

    if (
      e.button === 0 &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.defaultPrevented &&
      isLocal
    ) {
      e.preventDefault();
      router[using](href, {
        scroll: shouldScroll,
        ...(mask ? { mask: mask } : {}),
      });
    } else {
      startTransition(async () => {
        startProgress();
        await new Promise((resolve, reject) => {});
      });
    }
  }

  const Tag = as || "a";

  return (
    <Tag {...props} ref={ref} href={mask ? mask : href} onClick={handleClick}>
      {children}
    </Tag>
  );
}

function isLocalLink(path: string) {
  try {
    let urlObject = new URL(path, window.location.origin);
    return urlObject.origin === window.location.origin;
  } catch (e) {
    return false;
  }
}
