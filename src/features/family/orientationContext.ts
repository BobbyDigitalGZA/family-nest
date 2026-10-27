import { createContext, useContext } from 'react'
import type { Orientation } from '../../domain/layout'

export const OrientationContext = createContext<Orientation>('landscape')
export const useWallOrientation = (): Orientation => useContext(OrientationContext)
