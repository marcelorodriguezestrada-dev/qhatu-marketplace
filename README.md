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

- `/` — catálogo público con buscador, filtro por categoría y carrito.
- `/checkout` — crea el pedido, muestra tu QR (o los datos de tu cuenta)
  y espera que confirmes el pago desde `/admin`.
- `/admin` — panel protegido por contraseña: lista los pedidos y te deja
  marcar "Confirmar pago" a mano.
- `/api/productos` — catálogo (GET público, POST para dar de alta — hoy
  sin autenticación, sumale algo antes de exponerlo a vendedores
  externos).
- `/api/pedidos` — GET (lista, protegido con contraseña) y POST (crea un
  pedido nuevo, lo llama el checkout).
- `/api/pedidos/[id]` — GET (consulta pública, usada para el polling del
  comprador) y PATCH (cambia el estado: el comprador puede marcar
  "informado_pago" sin contraseña; solo vos podés marcar "pagado", con
  la contraseña de admin).

## 1. Instalar dependencias

```bash
npm install
```

## 2. Configurar Firebase (Firestore) — gratis

1. Andá a [console.firebase.google.com](https://console.firebase.google.com) → **Crear proyecto**.
2. **Compilación → Firestore Database** → **Crear base de datos** → modo producción → elegí una región cercana a Bolivia (ej. `southamerica-east1`).
   - No hace falta crear colecciones a mano — se crean solas (`productos`, `pedidos`) la primera vez que la app escribe en ellas. Si `productos` está vacía, el catálogo cae automáticamente a los datos de ejemplo de `src/data/productos.ts`.
   - El plan gratuito (Spark) de Firestore alcanza sobra para un catálogo chico/mediano — no necesitás activar facturación.
3. **⚙️ Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada** → descarga un `.json`. De ahí sacás `project_id`, `client_email` y `private_key`.

## 3. Configurar tu cobro por QR

Elegí una opción y completá las variables correspondientes en `.env.local`:

- **Con imagen de QR**: subí tu captura a `public/qr-pago.png` (reemplazando el archivo `public/README-qr.txt` de ejemplo) y configurá `NEXT_PUBLIC_QR_IMAGE_URL=/qr-pago.png`.
- **Sin imagen todavía**: dejá esa variable vacía y completá `NEXT_PUBLIC_BANK_NAME`, `NEXT_PUBLIC_BANK_ACCOUNT_NAME` y `NEXT_PUBLIC_BANK_ACCOUNT_NUMBER` — el checkout va a mostrar esos datos en texto.

## 4. Variables de entorno

```bash
cp .env.example .env.local
```

Completá cada valor. Ojo con `FIREBASE_PRIVATE_KEY`: copiala tal cual viene en el JSON descargado, entre comillas, con los `\n` literales (el código ya se encarga de convertirlos). `ADMIN_PASSWORD` la elegís vos — es la contraseña para entrar a `/admin`.

## 5. Correr en desarrollo

```bash
npm run dev
```

Sitio: [http://localhost:3000](http://localhost:3000). Panel de administración: [http://localhost:3000/admin](http://localhost:3000/admin)

Podés probar el catálogo y el carrito sin tener Firebase configurado todavía (cae a datos de ejemplo). Para probar el checkout y `/admin` de verdad, necesitás Firebase configurado.

## 6. Desplegar en Vercel — gratis

1. Subí este proyecto a un repo de GitHub.
2. En [vercel.com](https://vercel.com) → **Add New → Project** → importá el repo (el plan Hobby es gratis).
3. En **Settings → Environment Variables**, cargá las mismas variables de `.env.local`.
4. Deploy.

## Qué falta para un negocio más grande (no incluido todavía)

- **Panel de vendedor multi-usuario**: hoy `/admin` es un panel único para vos como dueño de toda la tienda, y `/api/productos` (POST) no tiene login — para un marketplace real con múltiples vendedores, cada uno necesita su propio login y solo poder editar lo suyo.
- **Envíos**: no hay ningún módulo de logística — hay que definir cómo se entrega cada pedido.
- **Confirmación automática de pago**: mientras uses QR manual, siempre vas a tener que entrar a `/admin` a confirmar a mano. El día que te aprueben OpenBCB (o decidas pagar CUCU u otro proveedor), ese paso se puede automatizar reemplazando la lógica de `/checkout` y agregando un endpoint de webhook — el resto del proyecto (Firestore, carrito, catálogo) no cambia.
- **Página de detalle de producto** y **historial de pedidos del comprador** — hoy el catálogo es solo una grilla con carrito.
# qhatu-marketplace
