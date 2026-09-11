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
