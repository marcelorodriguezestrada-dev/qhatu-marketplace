# Qhatu — Marketplace Bolivia (versión 100% gratis)

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
- `/login` — registro e inicio de sesión (email + contraseña, vía Firebase Auth).
- `/vender` — panel para que cualquier usuario logueado publique y borre sus propios **productos**, con foto real (sube a ImgBB) o ícono de respaldo si prefiere no subir imagen. Redirige a `/login` si no estás logueado.
- `/checkout` — crea el pedido (asociado a tu cuenta si estás logueado, o como invitado si no), muestra tu QR y espera que confirmes el pago desde `/admin`.
- `/admin` — tu panel único como dueño de la plataforma, con dos pestañas:
  - **Pedidos**: lista y confirmación manual de pagos.
  - **Servicios profesionales**: alta y baja de profesionales del directorio. A diferencia de los productos (que cualquier usuario publica solo), los profesionales **solo los cargás vos desde acá** — así lo plantea el negocio: el profesional te contacta a vos, y vos lo subís clasificado.
- `/api/productos` — GET público (catálogo completo). POST requiere estar logueado y asocia el producto al usuario.
- `/api/productos/[id]` — DELETE y PATCH, solo para el usuario dueño del producto.
- `/api/upload-image` — sube una foto a ImgBB y devuelve la URL. Requiere estar logueado.
- `/api/profesionales` — GET público (directorio completo). POST protegido con `ADMIN_PASSWORD`.
- `/api/profesionales/[id]` — GET público (perfil + reseñas). DELETE protegido con `ADMIN_PASSWORD`.
- `/api/profesionales/[id]/resenas` — POST: deja una reseña, requiere estar logueado (mismo sistema de cuentas que productos). El promedio se recalcula automáticamente en cada reseña nueva.
- `/api/pedidos` — GET (lista completa, protegida con `ADMIN_PASSWORD`) y POST (crea un pedido, lo llama el checkout).
- `/api/pedidos/[id]` — GET (consulta pública, usada para el polling del comprador) y PATCH (el comprador puede marcar "informado_pago" sin contraseña; solo vos podés marcar "pagado", con `ADMIN_PASSWORD`).

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

## 6. Correr en desarrollo

```bash
npm run dev
```

Sitio: [http://localhost:3000](http://localhost:3000). Panel de administración: [http://localhost:3000/admin](http://localhost:3000/admin)

Podés probar el catálogo y el carrito sin tener Firebase configurado todavía (cae a datos de ejemplo). Para probar el checkout y `/admin` de verdad, necesitás Firebase configurado.

## 7. Desplegar en Vercel — gratis

1. Subí este proyecto a un repo de GitHub.
2. En [vercel.com](https://vercel.com) → **Add New → Project** → importá el repo (el plan Hobby es gratis).
3. En **Settings → Environment Variables**, cargá las mismas variables de `.env.local`.
4. Deploy.

## Qué falta para un negocio más grande (no incluido todavía)

- **Suscripciones pagas**: hoy publicar productos y aparecer en el directorio de servicios es gratis. El documento original plantea cobrar una suscripción mensual a vendedores/profesionales — no está implementado (es el siguiente bloque natural a construir).
- **Verificación de local físico + ocultar datos hasta contacto**: tampoco está implementado — hoy toda la info de contacto (WhatsApp) es pública desde el perfil.
- **Reparto con "Chepibes"**: no hay ningún sistema de logística — la entrega hoy se coordina fuera de la plataforma (WhatsApp o retiro en el local).
- **Editar un profesional ya publicado**: desde `/admin` podés dar de alta y borrar, pero no editar — para cambiar algo hay que borrar y volver a cargar.
- **Recuperar contraseña / verificar email**: `/login` hoy solo tiene registro e inicio de sesión simples.
- **Envíos** para el carrito de productos: no hay ningún módulo de logística.
- **Confirmación automática de pago**: mientras uses QR manual, siempre vas a tener que entrar a `/admin` a confirmar a mano.
- **Página de detalle de producto** y **"mis compras" para el comprador**.
- **Moderación**: cualquier usuario logueado puede publicar productos sin revisión (los profesionales sí quedan controlados, porque solo vos los cargás).
