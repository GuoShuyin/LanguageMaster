import type { Request, Response, NextFunction } from 'express'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId: string
    }
  }
}

const ID_RE = /^[A-Za-z0-9-]{8,64}$/

// Pre-launch identity: the client generates an anonymous ID (src/userId.ts) and
// sends it as `X-User-Id`. Replace with real auth before launch.
export function userMiddleware(req: Request, res: Response, next: NextFunction): void {
  const id = req.header('x-user-id')
  req.userId = id && ID_RE.test(id) ? id : 'anonymous'
  next()
}
