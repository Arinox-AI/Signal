"use client";

import Link from "next/link";
import type { ComponentProps, MouseEvent } from "react";

type ScrollToTopLinkProps = ComponentProps<typeof Link>;

function resetScrollPosition() {
  const root = document.documentElement;
  const previousBehavior = root.style.scrollBehavior;
  root.style.scrollBehavior = "auto";
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });

  window.requestAnimationFrame(() => {
    root.style.scrollBehavior = previousBehavior;
  });
}

export function ScrollToTopLink({
  onClick,
  scroll = true,
  ...props
}: ScrollToTopLinkProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    resetScrollPosition();
  }

  return <Link {...props} scroll={scroll} onClick={handleClick} />;
}
