import { createContext, useContext } from 'react'
import type { Orientation } from '../../domain/layout'

export const OrientationContext = createContext<Orientation>('landscape')
export const useWallOrientation = (): Orientation => useContext(OrientationContext)

/** Escala del lienzo de la pared: lo que se dibuja fuera de él (arrastre) la necesita. */
export const WallScaleContext = createContext<number>(1)
export const useWallScaleFactor = (): number => useContext(WallScaleContext)
