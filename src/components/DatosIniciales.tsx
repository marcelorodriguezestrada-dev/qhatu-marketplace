'use client'

import { createContext, useContext } from 'react'

// Datos que el layout (servidor) ya leyó de Firestore, para que la página
// (client component) se dibuje con el contenido desde el primer HTML:
// Google ve el producto / perfil sin esperar a que cargue el navegador.
// La página igual vuelve a pedir los datos y los actualiza.
const Ctx = createContext<Record<string, any>>({})

export function DatosIniciales({ datos, children }: { datos: Record<string, any>; children: React.ReactNode }) {
  return <Ctx.Provider value={datos}>{children}</Ctx.Provider>
}

export function useDatoInicial<T = any>(clave: string): T | undefined {
  return useContext(Ctx)[clave] as T | undefined
}
