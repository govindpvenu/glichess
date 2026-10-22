import { Link } from "react-router"

import { Button } from "@/components/ui/button"

export function NotFoundPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col items-start px-4 py-24 sm:px-6">
      <p className="label-mono">404</p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">This square is empty.</h1>
      <p className="mt-3 text-muted-foreground">The page you were looking for doesn't exist.</p>
      <Button asChild className="mt-8">
        <Link to="/">Back to the board</Link>
      </Button>
    </div>
  )
}
