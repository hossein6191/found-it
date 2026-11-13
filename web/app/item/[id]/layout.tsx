// The route's own browser title, from the URL alone: no chain read, and a made-up id never reaches the title.
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const m = /^L?([1-9]\d{0,8})$/i.exec(id);
  return {
    title: m ? `Item L${m[1]}` : "Item",
    description: "One lost item: what anyone may know, its sealed marks, every claim with its finding, and what its owner, its finder or anyone may do now.",
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
