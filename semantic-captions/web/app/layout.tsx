import type { Metadata } from "next";
import type { ReactNode } from "react";

/** Root document shell for global metadata and future accessible styling. */
export const metadata: Metadata = {
  title: "Semantic Captions",
  description: "Real-time captions enriched with audible context.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  // TODO: Add global styles, viewport metadata, and PWA manifest configuration.
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

