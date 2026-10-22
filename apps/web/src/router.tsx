import { createBrowserRouter } from "react-router"

import { AppShell } from "@/components/app-shell"
import { HomePage } from "@/routes/home"
import { NotFoundPage } from "@/routes/not-found"

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      {
        path: "game/:gameId",
        // The board and chess libraries load only when a game is opened.
        lazy: async () => ({ Component: (await import("@/routes/game")).GameRoute }),
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
])
