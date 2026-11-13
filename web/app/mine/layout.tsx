import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mine",
  description: "The items you lost and the items you found, your credit for claim bonds, and the seals this browser keeps.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
