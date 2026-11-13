import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "The ledger",
  description: "Every item on the shelf, and every atto the contract holds and has paid.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
