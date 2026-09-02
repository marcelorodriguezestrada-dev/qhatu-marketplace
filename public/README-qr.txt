Poné acá tu QR de cobro como qr-pago.png (una captura de pantalla del
QR que te genera tu propia app bancaria o Yape sirve perfecto).

Después, en las variables de entorno (.env.local en local, o en
Vercel), configurá:
  NEXT_PUBLIC_QR_IMAGE_URL=/qr-pago.png
