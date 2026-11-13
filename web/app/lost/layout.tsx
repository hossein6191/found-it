import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Post a lost item",
  description: "Post a lost item with a reward: say what anyone may know, seal what only you know, and keep the marks and the salt.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
