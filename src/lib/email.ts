// ─────────────────────────────────────────────
// Envío de mails de turnos con Resend — SOLO se importa desde API
// routes (nunca desde un componente de cliente). Adaptado del sistema
// de un solo consultorio a multi-profesional: ahora cada mail lleva el
// nombre del profesional, no un nombre fijo hardcodeado.
// ─────────────────────────────────────────────

import { Resend } from 'resend'

function getResend() {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  return new Resend(key)
}

const FROM = process.env.EMAIL_FROM || 'Clasi Click <onboarding@resend.dev>'

type DatosTurno = {
  nombre: string
  profesionalNombre: string
  diaLabel: string
  hora: string
}

// Si no hay RESEND_API_KEY configurada, no rompe nada — el turno ya se
// guardó en Firestore de todos modos, simplemente no se manda mail.
export async function enviarConfirmacionTurno(destino: string, turno: DatosTurno) {
  const resend = getResend()
  if (!resend) return null
  return resend.emails.send({
    from: FROM,
    to: destino,
    subject: `Turno confirmado con ${turno.profesionalNombre} — ${turno.diaLabel}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color:#2B211D;">
        <h2 style="color:#7A2E2E;">¡Turno confirmado, ${turno.nombre}!</h2>
        <p>Tu turno con <strong>${turno.profesionalNombre}</strong> quedó reservado para el
        <strong>${turno.diaLabel}</strong> a las <strong>${turno.hora}</strong>.</p>
        <p style="margin-top:24px; font-size:13px; color:#6b5f57;">Clasi Click</p>
      </div>
    `,
  })
}

type DatosTurnoCompleto = DatosTurno & {
  contacto: string
  contactoTipo: 'mail' | 'whatsapp'
}

// Le avisa al profesional (no al cliente) que le reservaron un turno nuevo.
export async function enviarNotificacionTurnoProfesional(destino: string, turno: DatosTurnoCompleto) {
  const resend = getResend()
  if (!resend) return null
  return resend.emails.send({
    from: FROM,
    to: destino,
    subject: `Nuevo turno: ${turno.nombre} — ${turno.diaLabel} ${turno.hora}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color:#2B211D;">
        <h2 style="color:#7A2E2E;">Te reservaron un turno nuevo</h2>
        <table style="width:100%; border-collapse:collapse; font-size:14px;">
          <tr><td style="padding:4px 0; color:#6b5f57;">Cliente</td><td style="padding:4px 0;"><strong>${turno.nombre}</strong></td></tr>
          <tr><td style="padding:4px 0; color:#6b5f57;">Día y hora</td><td style="padding:4px 0;">${turno.diaLabel} · ${turno.hora}</td></tr>
          <tr><td style="padding:4px 0; color:#6b5f57;">Contacto</td><td style="padding:4px 0;">${turno.contacto} (${turno.contactoTipo === 'mail' ? 'mail' : 'WhatsApp'})</td></tr>
        </table>
        <p style="margin-top:20px; font-size:13px; color:#6b5f57;">
          Ver todos tus turnos en tu perfil, sección "Mis turnos".
        </p>
      </div>
    `,
  })
}

// Recordatorio al CLIENTE, mandado manualmente por el profesional (botón
// "Recordar" en Mis turnos) o automáticamente 1 día antes (ver
// /api/turnos/recordatorios-automaticos, que solo puede mandar mail —
// no hay forma de mandar un WhatsApp sin que la persona lo abra ella misma).
export async function enviarRecordatorioTurno(destino: string, turno: DatosTurno) {
  const resend = getResend()
  if (!resend) return null
  return resend.emails.send({
    from: FROM,
    to: destino,
    subject: `Recordatorio: tu turno con ${turno.profesionalNombre} es mañana`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color:#2B211D;">
        <h2 style="color:#7A2E2E;">Recordatorio de tu turno</h2>
        <p>Hola ${turno.nombre}, te escribimos para recordarte tu turno con <strong>${turno.profesionalNombre}</strong>:</p>
        <p style="font-size:16px;"><strong>${turno.diaLabel} a las ${turno.hora}</strong></p>
        <p style="margin-top:20px; font-size:13px; color:#6b5f57;">Si ya no podés asistir, avisale directamente para que pueda ofrecer ese horario a otra persona.</p>
        <p style="margin-top:24px; font-size:13px; color:#6b5f57;">Clasi Click</p>
      </div>
    `,
  })
}

// Código de 6 dígitos para verificar el email al registrarse. Si no hay
// RESEND_API_KEY configurada, devolvemos null sin romper nada — el
// endpoint que llama a esto ya sabe mostrarle al usuario un aviso en
// vez de dejarlo esperando un mail que nunca va a llegar.
export async function enviarCodigoVerificacion(destino: string, codigo: string) {
  const resend = getResend()
  if (!resend) return null
  return resend.emails.send({
    from: FROM,
    to: destino,
    subject: `${codigo} — Tu código de verificación de Clasi Click`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color:#2B211D;">
        <h2 style="color:#7A2E2E;">Confirmá tu cuenta</h2>
        <p>Usá este código para verificar tu email en Clasi Click:</p>
        <p style="font-size:32px; font-weight:bold; letter-spacing:6px; text-align:center; margin:24px 0; color:#7A2E2E;">${codigo}</p>
        <p style="font-size:13px; color:#6b5f57;">Vence en 15 minutos. Si no fuiste vos, podés ignorar este mail.</p>
        <p style="margin-top:24px; font-size:13px; color:#6b5f57;">Clasi Click</p>
      </div>
    `,
  })
}
