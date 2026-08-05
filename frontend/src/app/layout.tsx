import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "RepoVerse — Local Codebase Intelligence",
  description: "A local-first 3D visualization of your codebase.",
  authors: [{ name: "Emre Lutfi", url: "https://emrelutfi.com" }],
  creator: "Emre Lutfi",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="tr"><body>{children}</body></html>;
}
