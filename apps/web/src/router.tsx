import { createBrowserRouter } from "react-router"

import { AppShell } from "@/components/app-shell"
import { HomePage } from "@/routes/home"
import { NotFoundPage } from "@/routes/not-found"

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
])
