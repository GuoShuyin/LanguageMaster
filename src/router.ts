import { useEffect, useState } from 'react'

// Hash routes: #/local, #/watch?url=..., #/community, #/pricing
export type RouteName = 'local' | 'watch' | 'community' | 'pricing'

export interface Route {
  name: RouteName
  params: URLSearchParams
}

function parse(): Route {
  const [path, query = ''] = window.location.hash.replace(/^#\/?/, '').split('?')
  const names: RouteName[] = ['local', 'watch', 'community', 'pricing']
  const name = names.includes(path as RouteName) ? (path as RouteName) : 'local'
  return { name, params: new URLSearchParams(query) }
}

export function navigate(name: RouteName, params?: Record<string, string>): void {
  const query = params ? `?${new URLSearchParams(params)}` : ''
  window.location.hash = `/${name}${query}`
}

export function useRoute(): Route {
  const [route, setRoute] = useState(parse)
  useEffect(() => {
    const onChange = () => setRoute(parse())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}
