# Clasi Click — Marketplace Bolivia (versión 100% gratis)

Tienda online multivendedor tipo Mercado Libre, con cobro por **QR
manual** (tu propio QR bancario o de Yape) — sin ningún servicio pago
de por medio. Construida con **Next.js 14 (App Router) + TypeScript +
Tailwind CSS**, con **Firebase (Firestore, plan gratuito Spark)** como
backend, pensada para desplegar en el **plan Hobby (gratis) de
Vercel**.

## Cómo funciona el cobro (y por qué es así)

Investigué las opciones de pago por QR en Bolivia antes de armar esto:

- **CUCU** (API QR Simple) — tiene costo: Bs 1.200 de integración +
  Bs 250/mes. Por eso no se usa acá.
- **OpenBCB** (API gratuita del Banco Central de Bolivia) — el costo sí
  es cero, pero **no es autoservicio**: según la guía oficial del BCB,
  hace falta que una empresa presente una solicitud formal (con una
  declaración de aceptación y cumplimiento) y que la Gerencia de
  Entidades Financieras del BCB la evalúe y apruebe. Es un trámite
  institucional, no algo que te dé una API key al toque. Si en algún
  momento te aprueban el acceso, es la mejora natural sobre esto (ver
  más abajo).
- **QR manual (lo que usa este proyecto)** — mostrás tu propio QR
  bancario (una captura desde la app de tu banco) en el checkout, el
  comprador te transfiere y avisa apretando "Ya pagué", y vos confirmás
  el pago a mano desde el panel `/admin` una vez que lo viste acreditado
  en tu cuenta. Cero costo, cero trámite, andando desde el día uno.

## Cómo está armado

- `/` — catálogo público de productos, con buscador, filtro por categoría y carrito.
- `/servicios` — **directorio de servicios profesionales** (contadores, odontólogos, pintores, etc.), separado del carrito de compra. Buscable por nombre/zona, filtrable por rubro, y ordenable por mejor calificados o por cercanía (usando la ubicación del navegador + fórmula de Haversine contra la lat/lng que cargaste de cada profesional).
- `/servicios/[id]` — perfil público de un profesional: descripción, botón directo a WhatsApp (con mensaje precargado), y reseñas de otros usuarios (requiere estar logueado para dejar una).
- `/publicar-servicio` — **formulario público** para que un profesional se autopostule (sin login). Queda con estado `pendiente_revision` y no aparece en `/servicios` hasta que lo apruebes desde `/admin`. No acepta foto en esta etapa (se coordina por WhatsApp después de aprobar), para no exponer el endpoint de subida de imágenes al público sin ningún tipo de autenticación.
- `/login` — registro e inicio de sesión (email + contraseña, vía Firebase Auth).
- `/vender` — panel para que cualquier usuario logueado publique y borre sus propios **productos**, con foto real (sube a ImgBB) o ícono de respaldo si prefiere no subir imagen. Redirige a `/login` si no estás logueado.
- `/checkout` — pide zona/dirección de entrega, **separa el carrito por vendedor** (si comprás productos de 2 vendedores distintos, se generan 2 pedidos, uno para cada uno), y te hace pagar a cada vendedor por separado con su propio QR/CBU (o el de la plataforma, como respaldo, si ese vendedor todavía no configuró el suyo). El costo de envío se reparte proporcional entre los pedidos según el subtotal de cada uno.
- `/admin` — tu panel único como dueño de la plataforma, con cuatro pestañas:
  - **Pedidos**: lista y confirmación manual de pagos.
  - **Productos**: moderación (activo/pendiente/oculto/rechazado).
  - **Servicios profesionales**: alta directa (queda aprobada al toque) y una cola de **solicitudes pendientes** — las que llegan desde `/publicar-servicio` — con botones "Aprobar y publicar" o "Rechazar".
  - **Métricas**: usuarios registrados (Firebase Auth), total facturado, pedidos por estado, productos por estado, reseñas totales y productos más vistos. Todo con datos reales — ningún número estimado o inventado; si algo no se puede calcular de forma honesta, directamente no se muestra.
- `/api/productos` — GET público (catálogo completo). POST requiere estar logueado y asocia el producto al usuario.
- `/producto/[id]` — página de detalle de un producto: foto grande, descuento real si tiene, selector de cantidad, "Comprar ahora" o "Agregar al carrito", y productos relacionados de la misma categoría. Cada visita suma +1 a un contador de vistas (dato real usado en las métricas).
- `/api/productos/[id]` — GET público (detalle de un producto). DELETE y PATCH, solo para el usuario dueño.
- `/api/productos/[id]/vista` — POST público, sin autenticación: suma +1 al contador de vistas del producto. No guarda quién lo vio.
- `/api/upload-image` — sube una foto a ImgBB y devuelve la URL. Requiere estar logueado (usuario de Firebase) o la contraseña de admin (para las fotos de profesionales que cargás vos).
- **Favoritos** (corazón en cada tarjeta de producto): se guardan en `localStorage` del navegador, no en Firestore — es una preferencia liviana del dispositivo. Si en algún momento hace falta que los favoritos viajen entre dispositivos de un mismo usuario, ahí conviene moverlos a Firestore atados al usuario logueado.
- `/api/profesionales` — GET público (solo aprobados) o completo si se manda `ADMIN_PASSWORD` (para que `/admin` vea también pendientes y rechazados). POST (alta directa, queda aprobada) protegido con `ADMIN_PASSWORD`.
- `/api/profesionales/solicitud` — POST público, sin login ni contraseña: es el formulario de autopostulación. Crea el profesional con estado `pendiente_revision`.
- `/api/profesionales/[id]` — GET público (perfil + reseñas). PATCH (cambiar estado, editar datos) y DELETE, protegidos con `ADMIN_PASSWORD`.
- `/api/profesionales/[id]/resenas` — POST: deja una reseña, requiere estar logueado (mismo sistema de cuentas que productos). El promedio se recalcula automáticamente en cada reseña nueva.
- `/api/admin/metricas` — GET protegido con `ADMIN_PASSWORD`: devuelve todos los números que se ven en la pestaña Métricas.
- `/api/pedidos` — GET (lista completa con `ADMIN_PASSWORD`, o los pedidos propios como comprador/vendedor con login de Firebase) y POST (crea un pedido, lo llama el checkout — uno por cada vendedor distinto en el carrito).
- `/api/pedidos/[id]` — GET (consulta pública, usada para el polling del comprador). PATCH: el comprador marca "informado_pago" sin login; los estados de operación (pagado, en preparación, en entrega, entregado, cancelado) los puede marcar el admin (`ADMIN_PASSWORD`) **o el vendedor de ese pedido en particular** (con su login de Firebase) — porque con QR/CBU propio, es el vendedor quien recibe la plata y gestiona la entrega.
- `/api/vendedores` — POST (requiere login): el vendedor carga o actualiza su propio QR/CBU/nombre de negocio.
- `/api/vendedores/[id]` — GET público: perfil de cobro de un vendedor, usado por el checkout para saber a qué cuenta pagarle.

## 1. Instalar dependencias

```bash
npm install
```

## 2. Configurar Firebase (Firestore + Auth) — gratis

1. Andá a [console.firebase.google.com](https://console.firebase.google.com) → **Crear proyecto**.
2. **Compilación → Firestore Database** → **Crear base de datos** → modo producción → elegí una región cercana a Bolivia (ej. `southamerica-east1`).
   - No hace falta crear colecciones a mano — se crean solas (`productos`, `pedidos`) la primera vez que la app escribe en ellas. Si `productos` está vacía, el catálogo cae automáticamente a los datos de ejemplo de `src/data/productos.ts`.
   - El plan gratuito (Spark) alcanza sobra para arrancar.
3. **Compilación → Authentication** → **Comenzar** → en la pestaña "Sign-in method", habilitá el proveedor **Correo electrónico/contraseña**. Sin este paso, `/login` no va a funcionar.
4. **⚙️ Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada** → descarga un `.json`. De ahí sacás `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` y `FIREBASE_PRIVATE_KEY`.
5. **⚙️ Configuración del proyecto → Tus apps** → si no tenés una "app web" todavía, creá una (el ícono `</>`). Ahí te muestran `apiKey` y `authDomain` — van en `NEXT_PUBLIC_FIREBASE_API_KEY` y `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`.

## 3. Configurar ImgBB (fotos de producto) — gratis

Los vendedores suben la foto de cada producto directo desde `/vender`. Por atrás, la imagen se reenvía a **ImgBB** (hosting de imágenes gratuito, sin límite de tiempo, sin tarjeta):

1. Creá una cuenta gratis en [api.imgbb.com](https://api.imgbb.com/).
2. Generá tu API key desde ahí mismo.
3. Cargala en `IMGBB_API_KEY`.

Si no configurás esto, `/vender` sigue funcionando igual (el producto se puede publicar solo con el ícono, sin foto) — pero al intentar subir una imagen va a mostrar un error hasta que cargues la key.

## 4. Configurar tu cobro por QR

Elegí una opción y completá las variables correspondientes en `.env.local`:

- **Con imagen de QR**: subí tu captura a `public/qr-pago.png` (reemplazando el archivo `public/README-qr.txt` de ejemplo) y configurá `NEXT_PUBLIC_QR_IMAGE_URL=/qr-pago.png`.
- **Sin imagen todavía**: dejá esa variable vacía y completá `NEXT_PUBLIC_BANK_NAME`, `NEXT_PUBLIC_BANK_ACCOUNT_NAME` y `NEXT_PUBLIC_BANK_ACCOUNT_NUMBER` — el checkout va a mostrar esos datos en texto.

## 5. Variables de entorno

```bash
cp .env.example .env.local
```

Completá cada valor. Ojo con `FIREBASE_PRIVATE_KEY`: copiala tal cual viene en el JSON descargado, entre comillas, con los `\n` literales (el código ya se encarga de convertirlos). `ADMIN_PASSWORD` la elegís vos — es la contraseña para entrar a `/admin`.

## 6. Pre-filtro de moderación con IA (opcional, gratis)

Cuando alguien publica un producto (`/vender`) o se autopostula como profesional (`/publicar-servicio`), la IA evalúa el contenido y le pone una etiqueta de riesgo (bajo/medio/alto) visible en `/admin`, para ayudarte a priorizar qué revisar primero. **Nunca aprueba, rechaza ni bloquea nada por su cuenta** — la decisión final siempre es tuya.

Usa **Groq** (mismo proveedor que ya usa la app de consultorio), con plan gratuito real — sin tarjeta, ~14.400 requests por día:

1. Creá una cuenta en [console.groq.com](https://console.groq.com).
2. **API Keys → Create API key**.
3. Cargala en `GROQ_API_KEY`.

Si dejás la variable vacía, la app funciona exactamente igual, solo que sin la etiqueta de riesgo.

## 7. Correr en desarrollo

```bash
npm run dev
```

Sitio: [http://localhost:3000](http://localhost:3000). Panel de administración: [http://localhost:3000/admin](http://localhost:3000/admin)

Podés probar el catálogo y el carrito sin tener Firebase configurado todavía (cae a datos de ejemplo). Para probar el checkout y `/admin` de verdad, necesitás Firebase configurado.

## 8. Desplegar en Vercel — gratis

1. Subí este proyecto a un repo de GitHub.
2. En [vercel.com](https://vercel.com) → **Add New → Project** → importá el repo (el plan Hobby es gratis).
3. En **Settings → Environment Variables**, cargá las mismas variables de `.env.local`.
4. Deploy.

## Estado actual del MVP y próximos pasos reales

Lo que ya está integrado en la base del negocio:

- Marketplace multivendedor con publicación y moderación básica.
- Flujo de compra con QR manual, confirmación desde `/admin` y seguimiento por estados.
- Logística simple con zona, dirección y costo de envío.
- Historial de compras para el usuario y panel de ventas para el vendedor.
- Plan premium del vendedor para destacar productos en el catálogo.
- Directorio profesional con plan básico/premium y reseñas.
- **Formulario público de autopostulación para profesionales** (`/publicar-servicio`), con cola de revisión en `/admin` (aprobar/rechazar).
- **Panel de métricas** en `/admin`: usuarios registrados, facturación, pedidos y productos por estado, reseñas totales, productos más vistos — todo con datos reales de Firestore/Firebase Auth.
- **Contador de vistas por producto**, usado para el ranking de "más vistos".
- **Contador de vistas de perfil y clics a WhatsApp por profesional**, con ranking de "más contactados" en Métricas.
- **Filtro de insultos en reseñas** (Groq, gratis): si el comentario contiene lenguaje ofensivo, se bloquea antes de publicarse — no llega a una cola de revisión, se rechaza directo con un mensaje pidiendo reformular.
- **Botones grandes de "Productos" y "Servicios"** en la home, bien distinguidos visualmente.
- **Pago directo al vendedor**: cada vendedor configura su propio QR/CBU desde `/vender` ("Cobros"), y el checkout separa automáticamente el carrito en un pedido por vendedor si compraste de varios a la vez — cada uno cobra directo a su cuenta, sin pasar la plata por la plataforma. El vendedor confirma el pago recibido y gestiona la entrega de su propio pedido desde `/vender`, sin necesitar la contraseña de admin.
- **Pre-filtro de moderación con IA** (opcional, gratis con Groq — `GROQ_API_KEY`): etiqueta cada producto y solicitud de servicio nueva con un riesgo bajo/medio/alto, para priorizar tu revisión manual en `/admin`. Nunca decide por su cuenta.
- **Categorías de profesionales ampliadas y alfabéticas**: médico, oftalmólogo, enfermera a domicilio, abogado, estilista, manicurista, además de las que ya había — con un menú desplegable en vez de botones amontonados.
- **Mapa de profesionales** (Leaflet + OpenStreetMap, 100% gratis, sin API key) en `/servicios` — pide tu ubicación y muestra a los profesionales con coordenadas cargadas en un mapa real, no solo una lista ordenada por cercanía.
- **Instagram/red social opcional** en el perfil de cada profesional, debajo del botón de WhatsApp.
- **WhatsApp simplificado**: ahora se carga solo el número local de 8 dígitos (sin +591) — el sistema arma el link completo solo. Incluye una validación básica de formato (rechaza números con todos los dígitos iguales o secuencias obvias como 12345678) — **esto no es una verificación real por SMS** (eso requeriría un servicio pago tipo Twilio, fuera del alcance gratuito del proyecto), solo filtra los casos más obvios de números inventados.
- **Login obligatorio ampliado**: ahora hace falta estar logueado para agregar productos al carrito, completar una compra, y publicar un servicio en `/publicar-servicio` (antes esta última era pública sin cuenta). Navegar y explorar el catálogo y el directorio sigue siendo 100% libre, sin necesidad de cuenta.
- **Retiro en tienda o envío** como opciones explícitas en el checkout — si el comprador elige retiro, no se cobra envío y coordina el retiro por WhatsApp con cada vendedor.
- **Sección de "Ofertas"** destacada en la home, mostrando solo productos con descuento real cargado por el vendedor (nunca porcentajes inventados).

Lo que todavía no está incluido en esta base:

- Verificación de local físico + ocultar contacto hasta contacto directo.
- Reparto con operador externo / chepibes automatizado.
- Edición de profesionales ya publicados directamente desde el panel (hoy se puede aprobar/rechazar/borrar, pero no editar los datos ya cargados).
- Recuperar contraseña / verificar email en el flujo de acceso.
- Confirmación automática de pago por gateway real.
- Moderación avanzada de vendedores y contenido con revisión manual más estricta.
- Página "Mis favoritos" para ver todo lo guardado en un solo lugar (hoy el corazón funciona en cada tarjeta, pero no hay una vista consolidada).
- **Ojo con esto**: si un vendedor no configuró su propio QR/CBU en `/vender`, sus ventas caen al QR general de la plataforma como respaldo — en ese caso, la plata te llega a vos (no al vendedor), y como no hay ninguna pasarela de pago real integrada, transferirle esa plata al vendedor es un paso manual tuyo, fuera de la app. Avisale a cada vendedor que configure su cobro apenas empiece a vender, para que esto no pase.
- Cuponera, turnos con calendario y detección de patrones de búsqueda — quedan pendientes de una próxima vuelta.
- **Estrategia "mes gratis" + Device ID**: no aplica todavía porque no existe ningún sistema de suscripciones pagas en la plataforma — es prematuro rastrear abuso de una promoción que no existe. Cuando se construya la cuponera/suscripciones, ahí sí tiene sentido retomarlo.
- **Verificación real de WhatsApp por SMS**: solo hay validación de formato (ver arriba), no una confirmación real de que el número existe — requeriría un servicio pago.
