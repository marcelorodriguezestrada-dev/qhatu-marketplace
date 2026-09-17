import { Suspense } from 'react'
import RepartoHoyContenido from './RepartoHoyContenido'

export default function RepartoHoyPage() {
  return (
    <Suspense fallback={null}>
      <RepartoHoyContenido />
    </Suspense>
  )
}
