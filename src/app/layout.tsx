import type { Metadata, Viewport } from "next";
import "bootstrap/dist/css/bootstrap.min.css";
import "remixicon/fonts/remixicon.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "./globals.scss";
import { PwaRegister } from "@/components/pwa-register";
import { PermissionGate } from "@/components/permission-gate";
import { PushSound } from "@/components/push-sound";
import { InteractionLock } from "@/components/interaction-lock";
export const metadata: Metadata = {
  title: { default: "Opsora", template: "%s | Opsora" },
  description: "Opsora — Assign. Execute. Verify. Track.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/opsora-logo.png" },
};
export const viewport: Viewport = { themeColor: "#181a2b" };
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <InteractionLock>
          <PwaRegister />
          <PermissionGate />
          <PushSound />
          {children}
        </InteractionLock>
      </body>
    </html>
  );
}
