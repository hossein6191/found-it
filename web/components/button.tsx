"use client";

// The one button of the site: a rounded rectangle with a stitched border that presses down. Four
// colours: twine (the main action), green (money coming to you), kraft and paper (everything else).

import * as React from "react";
import Link from "next/link";

import { cx } from "@/lib/cx";

type Variant = "twine" | "green" | "kraft" | "paper";
type Common = { variant?: Variant; size?: "sm" | "md"; block?: boolean; icon?: React.ReactNode; className?: string; children: React.ReactNode };

const classes = (variant: Variant, size: "sm" | "md", block?: boolean, className?: string) =>
  cx("btn", variant !== "twine" && `btn-${variant}`, size === "sm" && "btn-sm", block && "btn-block", className);

export function Button({ variant = "twine", size = "md", block, icon, className, children, type = "button", ...rest }: Common & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children" | "className">) {
  return (
    <button type={type} className={classes(variant, size, block, className)} {...rest}>
      {icon}
      <span>{children}</span>
    </button>
  );
}

export function ButtonLink({ variant = "twine", size = "md", block, icon, className, children, href }: Common & { href: string }) {
  return (
    <Link href={href} className={classes(variant, size, block, className)}>
      {icon}
      <span>{children}</span>
    </Link>
  );
}
