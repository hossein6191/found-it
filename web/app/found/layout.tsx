import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "The demo shelf",
  description: "Pick a lost item off the demo shelf, see what its finder sees, describe it, and watch the validators judge the description before the reward moves.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
