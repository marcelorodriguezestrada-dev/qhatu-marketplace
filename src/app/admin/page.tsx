'use client'

import { useEffect, useState } from 'react'
import { ServiceIcon } from '@/components/ServiceIcon'
import { GraficoBarras } from '@/components/GraficoBarras'
import { useCategorias } from '@/lib/useCategorias'
import { useCategoriasProductos } from '@/lib/useCategoriasProductos'
import { labelPublicoProducto } from '@/data/publicoProducto'
import { DIAS_SEMANA, INTERVALOS_TURNO, BloqueHorario } from '@/data/turnos'
import { calcularNuevaVigencia } from '@/lib/planPremium'

function bs(n: number) {
  return 'Bs ' + n.toLocaleString('es-BO')
}

const ESTADOS_LABEL: Record<string, { texto: string; color: string }> = {
  pendiente_pago: { texto: 'Esperando que pague', color: 'text-inksoft' },
  informado_pago: { texto: 'Dice que ya pagó — revisar', color: 'text-ochre' },
  pagado: { texto: 'Pagado', color: 'text-teal' },
  en_preparacion: { texto: 'En preparación', color: 'text-indigo-600' },
  en_entrega: { texto: 'En entrega', color: 'text-amber-600' },
  entregado: { texto: 'Entregado', color: 'text-emerald-600' },
  cancelado: { texto: 'Cancelado', color: 'text-red-600' },
}

const ICONOS_SERVICIO = ['abogado', 'contador', 'electricista', 'enfermera', 'estilista', 'ingeniero', 'manicurista', 'medico', 'odontologo', 'oftalmologo', 'pintor', 'plomero', 'profesor', 'otro']

// Qué números se pueden graficar en la línea de tiempo de Métricas, y
// cómo mostrar cada uno (etiqueta corta para el selector, color de la
// barra, y si es plata para formatear en Bs en vez de un número pelado).
const CAMPOS_METRICAS = {
  visitas: { label: 'Visitas al sitio', color: '#1a7f6e' },
  vistasProductos: { label: 'Vistas de productos', color: '#8a5a2f' },
  vistasProfesionales: { label: 'Vistas de profesionales', color: '#8a5a2f' },
  clicsWhatsapp: { label: 'Clics a WhatsApp', color: '#25a244' },
  busquedasProductos: { label: 'Búsquedas de productos', color: '#b08900' },
  busquedasServicios: { label: 'Búsquedas de servicios', color: '#b08900' },
  pedidos: { label: 'Pedidos', color: '#7a1f2b' },
  facturado: { label: 'Facturado (Bs)', color: '#7a1f2b', esPlata: true },
  productosPublicados: { label: 'Productos publicados', color: '#3a5a8a' },
  profesionalesPublicados: { label: 'Profesionales publicados', color: '#3a5a8a' },
} as const

function BadgeRiesgoIA({ moderacionIA }: { moderacionIA: { riesgo: string; motivo: string } | null | undefined }) {
  if (!moderacionIA) return null
  const estilos: Record<string, string> = {
    alto: 'bg-maroonsoft text-maroon border-maroon',
    medio: 'bg-ochresoft text-ochre border-ochre',
    bajo: 'bg-tealsoft text-teal border-teal',
  }
  const clase = estilos[moderacionIA.riesgo] || 'bg-panelalt text-inksoft border-line'
  return (
    <div className={`inline-flex items-center gap-1 border rounded-full px-2 py-0.5 text-[10px] font-semibold font-body mt-1 ${clase}`} title={moderacionIA.motivo}>
      IA: riesgo {moderacionIA.riesgo}
    </div>
  )
}

export default function AdminPage() {
  const [password, setPassword] = useState('')
  const [autenticado, setAutenticado] = useState(false)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [tab, setTab] = useState<'pedidos' | 'productos' | 'servicios' | 'categorias' | 'categorias-productos' | 'metricas' | 'usuarios'>('pedidos')
  const { categorias, buscarRubro, recargar: recargarCategorias } = useCategorias()
  const { categorias: categoriasProductos, buscarRubroProducto, recargar: recargarCategoriasProductos } = useCategoriasProductos()

  const [pedidos, setPedidos] = useState<any[]>([])
  const [productos, setProductos] = useState<any[]>([])
  const [profesionales, setProfesionales] = useState<any[]>([])
  const [metricas, setMetricas] = useState<any>(null)
  const [cargandoMetricas, setCargandoMetricas] = useState(false)
  // Línea de tiempo de la pestaña Métricas: qué período se ve
  // (día/mes/año) y qué número se está graficando.
  const [periodoMetricas, setPeriodoMetricas] = useState<'dia' | 'mes' | 'anio'>('dia')
  const [campoMetricas, setCampoMetricas] = useState<keyof typeof CAMPOS_METRICAS>('visitas')

  const resumen = {
    pedidosTotal: pedidos.length,
    pedidosPagados: pedidos.filter((p) => p.estado === 'pagado' || p.estado === 'en_preparacion' || p.estado === 'en_entrega' || p.estado === 'entregado').length,
    productosActivos: productos.filter((p) => p.estado === 'activo').length,
    productosPremium: productos.filter((p) => p.plan === 'premium').length,
    profesionalesTotal: profesionales.length,
  }

  // Formulario de alta de profesional
  const [nombre, setNombre] = useState('')
  const [emailProfesional, setEmailProfesional] = useState('')
  // Id de la solicitud para la que se está escribiendo la nota de "pedir
  // más info" en este momento (null = ninguna abierta), y el texto que
  // se va tipeando ahí.
  const [pidiendoInfoId, setPidiendoInfoId] = useState<string | null>(null)
  const [notaPidiendoInfo, setNotaPidiendoInfo] = useState('')
  const [rubro, setRubro] = useState('')
  const [categoriaSel, setCategoriaSel] = useState('')
  const [especialidad, setEspecialidad] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [zona, setZona] = useState('')
  const [direccion, setDireccion] = useState('')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [instagram, setInstagram] = useState('')
  const [icono, setIcono] = useState(ICONOS_SERVICIO[0])
  const [imagenUrl, setImagenUrl] = useState('')
  const [subiendoImagen, setSubiendoImagen] = useState(false)
  const [precio, setPrecio] = useState('')
  const [experiencia, setExperiencia] = useState('')
  const [plan, setPlan] = useState<'basico' | 'premium'>('basico')
  const [publicando, setPublicando] = useState(false)
  const [errorForm, setErrorForm] = useState('')
  // null = formulario en modo "publicar nuevo". Con un id, el mismo
  // formulario pasa a modo edición de ese profesional ya existente.
  const [profesionalEditandoId, setProfesionalEditandoId] = useState<string | null>(null)
  const [editHorarioBloques, setEditHorarioBloques] = useState<BloqueHorario[]>([])
  const [editNuevoBloqueDias, setEditNuevoBloqueDias] = useState<number[]>([])
  const [editNuevoBloqueDesde, setEditNuevoBloqueDesde] = useState('09:00')
  const [editNuevoBloqueHasta, setEditNuevoBloqueHasta] = useState('18:00')
  const [editNuevoBloqueIntervalo, setEditNuevoBloqueIntervalo] = useState(60)
  const [editNuevoBloqueTodoElDia, setEditNuevoBloqueTodoElDia] = useState(false)
  const [guardandoHorarioAdmin, setGuardandoHorarioAdmin] = useState(false)
  const [horarioAdminGuardado, setHorarioAdminGuardado] = useState(false)

  // Pestaña "Categorías": alta de categoría nueva, alta de rubro dentro
  // de una categoría, y reubicar un rubro existente a otra categoría.
  const [nuevaCategoriaLabel, setNuevaCategoriaLabel] = useState('')
  const [guardandoCategoria, setGuardandoCategoria] = useState(false)
  const [errorCategorias, setErrorCategorias] = useState('')
  const [categoriaAbierta, setCategoriaAbierta] = useState<string | null>(null)
  const [nuevoRubroLabel, setNuevoRubroLabel] = useState('')
  const [guardandoRubro, setGuardandoRubro] = useState(false)
  const [renombrandoCategoriaId, setRenombrandoCategoriaId] = useState<string | null>(null)
  const [nuevoNombreCategoria, setNuevoNombreCategoria] = useState('')

  // Pestaña "Categorías de productos": mismo esquema que la de
  // servicios de arriba, pero contra /api/categorias-productos.
  const [nuevaCategoriaProductoLabel, setNuevaCategoriaProductoLabel] = useState('')
  const [guardandoCategoriaProducto, setGuardandoCategoriaProducto] = useState(false)
  const [errorCategoriasProductos, setErrorCategoriasProductos] = useState('')
  const [categoriaProductoAbierta, setCategoriaProductoAbierta] = useState<string | null>(null)
  const [nuevoRubroProductoLabel, setNuevoRubroProductoLabel] = useState('')
  const [guardandoRubroProducto, setGuardandoRubroProducto] = useState(false)
  const [renombrandoCategoriaProductoId, setRenombrandoCategoriaProductoId] = useState<string | null>(null)
  const [nuevoNombreCategoriaProducto, setNuevoNombreCategoriaProducto] = useState('')

  useEffect(() => {
    if (categorias.length === 0 || categoriaSel) return
    setCategoriaSel(categorias[0].id)
    setRubro(categorias[0].rubros[0]?.id || 'otro')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categorias])

  useEffect(() => {
    const guardada = typeof window !== 'undefined' ? localStorage.getItem('clasiclick_admin_pw') : null
    if (guardada) {
      setPassword(guardada)
      entrar(guardada)
    }
  }, [])

  function entrar(pw: string) {
    setCargando(true)
    fetch('/api/pedidos', { headers: { 'x-admin-password': pw } })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error || 'Contraseña incorrecta.')
        return r.json()
      })
      .then((data) => {
        setPedidos(data.pedidos || [])
        setAutenticado(true)
        setError('')
        localStorage.setItem('clasiclick_admin_pw', pw)
        // Importante: le pasamos "pw" explícito acá, no dependemos del
        // estado "password" — en el login automático (contraseña
        // guardada en localStorage), el estado todavía no se actualizó
        // en este mismo instante, y usar la versión vieja hacía que
        // estos pedidos salieran sin contraseña válida (mostrando la
        // vista pública filtrada en vez de la completa).
        cargarProfesionales(pw)
        cargarProductos(pw)
      })
      .catch((e) => {
        setError(e.message)
        setAutenticado(false)
      })
      .finally(() => setCargando(false))
  }

  function cargarProfesionales(pw?: string) {
    fetch('/api/profesionales', { headers: { 'x-admin-password': pw ?? password } })
      .then((r) => r.json())
      .then((data) => setProfesionales(data.profesionales || []))
  }

  function cargarMetricas(pw?: string) {
    setCargandoMetricas(true)
    fetch('/api/admin/metricas', { headers: { 'x-admin-password': pw ?? password } })
      .then((r) => r.json())
      .then((data) => setMetricas(data))
      .finally(() => setCargandoMetricas(false))
  }

  function cargarProductos(pw?: string) {
    fetch('/api/productos', { headers: { 'x-admin-password': pw ?? password } })
      .then((r) => r.json())
      .then((data) => setProductos(data.productos || []))
  }

  function cambiarEstadoProducto(id: string, estado: 'activo' | 'pendiente' | 'rechazado' | 'oculto') {
    fetch(`/api/productos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
      body: JSON.stringify({ estado }),
    }).then(() => cargarProductos(password))
  }

  function cambiarEstadoPedido(id: string, estado: 'pagado' | 'en_preparacion' | 'en_entrega' | 'entregado' | 'cancelado') {
    fetch(`/api/pedidos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
      body: JSON.stringify({ estado }),
    }).then(() => entrar(password))
  }

  function confirmarPago(id: string) {
    cambiarEstadoPedido(id, 'pagado')
  }

  function eliminarPedido(id: string) {
    if (!confirm('¿Eliminar este pedido? Esta acción no se puede deshacer.')) return
    fetch(`/api/pedidos/${id}`, {
      method: 'DELETE',
      headers: { 'x-admin-password': password },
    }).then(() => entrar(password))
  }

  const [productoEditando, setProductoEditando] = useState<any>(null)
  const [editNombre, setEditNombre] = useState('')
  const [editPrecio, setEditPrecio] = useState('')
  const [editPrecioOriginal, setEditPrecioOriginal] = useState('')
  const [editCategoria, setEditCategoria] = useState('')
  const [editDescCorta, setEditDescCorta] = useState('')
  const [editDescLarga, setEditDescLarga] = useState('')
  const [editTalles, setEditTalles] = useState('')
  const [editColores, setEditColores] = useState('')
  const [editMateriales, setEditMateriales] = useState('')
  const [editEstado, setEditEstado] = useState('')
  const [guardandoEdit, setGuardandoEdit] = useState(false)

  const [usuarios, setUsuarios] = useState<any[]>([])
  const [cargandoUsuarios, setCargandoUsuarios] = useState(false)
  const [filtroUsuarios, setFiltroUsuarios] = useState('')
  const [notaUsuario, setNotaUsuario] = useState<Record<string, string>>({})

  function abrirEditarProducto(p: any) {
    setProductoEditando(p)
    setEditNombre(p.nombre || '')
    setEditPrecio(String(p.precio || ''))
    setEditPrecioOriginal(String(p.precioOriginal || ''))
    setEditCategoria(p.rubro || p.categoria || '')
    setEditDescCorta(p.descripcionCorta || '')
    setEditDescLarga(p.descripcionLarga || '')
    setEditTalles(Array.isArray(p.talles) ? p.talles.join(', ') : (p.talles || ''))
    setEditColores(Array.isArray(p.colores) ? p.colores.join(', ') : (p.colores || ''))
    setEditMateriales(p.materiales || '')
    setEditEstado(p.estado || 'activo')
  }

  async function guardarEditProducto() {
    if (!productoEditando) return
    setGuardandoEdit(true)
    const tallesArr = editTalles.split(',').map(s => s.trim()).filter(Boolean)
    const coloresArr = editColores.split(',').map(s => s.trim()).filter(Boolean)
    await fetch(`/api/productos/${productoEditando.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
      body: JSON.stringify({
        nombre: editNombre,
        precio: Number(editPrecio),
        precioOriginal: editPrecioOriginal ? Number(editPrecioOriginal) : null,
        rubro: editCategoria,
        descripcionCorta: editDescCorta,
        descripcionLarga: editDescLarga,
        talles: tallesArr,
        colores: coloresArr,
        materiales: editMateriales,
        estado: editEstado,
      }),
    })
    setGuardandoEdit(false)
    setProductoEditando(null)
    cargarProductos(password)
  }



  // Mismo endpoint que usan los vendedores en /vender, pero acá nos
  // autenticamos con la contraseña de admin en vez de un login de
  // Firebase (este panel no usa ese sistema de cuentas).
  async function subirImagenProfesional(file: File | null) {
    if (!file) return
    setSubiendoImagen(true)
    setErrorForm('')
    try {
      const formData = new FormData()
      formData.append('image', file)
      const res = await fetch('/api/upload-image', {
        method: 'POST',
        headers: { 'x-admin-password': password },
        body: formData,
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setImagenUrl(data.url)
    } catch (e: any) {
      setErrorForm('Error subiendo la imagen: ' + e.message)
    } finally {
      setSubiendoImagen(false)
    }
  }

  async function publicarProfesional(e: React.FormEvent) {
    e.preventDefault()
    setErrorForm('')
    if (!nombre.trim() || !whatsapp.trim()) {
      setErrorForm('Completá al menos el nombre y el WhatsApp.')
      return
    }
    setPublicando(true)
    try {
      const datos = {
        nombre, rubro, especialidad, descripcion, zona, direccion,
        lat: lat || null, lng: lng || null,
        whatsapp, instagram, email: emailProfesional, icono, plan, imagenUrl,
        precio: precio || null,
        experiencia,
      }
      const editando = !!profesionalEditandoId
      const res = await fetch(
        editando ? `/api/profesionales/${profesionalEditandoId}` : '/api/profesionales',
        {
          method: editando ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
          body: JSON.stringify(datos),
        }
      )
      const data = await res.json()
      if (data.error) {
        setErrorForm(data.error)
        return
      }
      setNombre(''); setDescripcion(''); setZona(''); setDireccion(''); setLat(''); setLng(''); setWhatsapp('')
      setImagenUrl(''); setPrecio(''); setExperiencia(''); setInstagram(''); setEmailProfesional(''); setEspecialidad('')
      setProfesionalEditandoId(null)
      cargarProfesionales()
    } finally {
      setPublicando(false)
    }
  }

  // Carga los datos de un profesional ya existente en el mismo
  // formulario de arriba (que pasa a modo "edición"), para poder
  // corregir cualquier dato sin tener que borrarlo y volver a cargarlo.
  function abrirEditarProfesional(p: any) {
    setProfesionalEditandoId(p.id)
    setNombre(p.nombre || '')
    const rubroInfo = buscarRubro(p.rubro)
    setCategoriaSel(rubroInfo?.categoriaId || categorias[0]?.id || '')
    setRubro(p.rubro || '')
    setEspecialidad(p.especialidad || '')
    setDescripcion(p.descripcion || '')
    setZona(p.zona || '')
    setDireccion(p.direccion || '')
    setLat(p.lat != null ? String(p.lat) : '')
    setLng(p.lng != null ? String(p.lng) : '')
    setWhatsapp(p.whatsapp || '')
    setInstagram(p.instagram || '')
    setEmailProfesional(p.email || '')
    setIcono(p.icono || ICONOS_SERVICIO[0])
    setImagenUrl(p.imagenUrl || '')
    setPrecio(p.precio != null ? String(p.precio) : '')
    setExperiencia(p.experiencia || '')
    setPlan(p.plan === 'premium' ? 'premium' : 'basico')
    setEditHorarioBloques(p.horarioTurnos?.bloques || [])
    setErrorForm('')
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelarEdicionProfesional() {
    setProfesionalEditandoId(null)
    setNombre(''); setDescripcion(''); setZona(''); setDireccion(''); setLat(''); setLng(''); setWhatsapp('')
    setImagenUrl(''); setPrecio(''); setExperiencia(''); setInstagram(''); setEmailProfesional(''); setEspecialidad('')
    setEditHorarioBloques([]); setEditNuevoBloqueDias([]); setEditNuevoBloqueTodoElDia(false)
    setErrorForm('')
  }

  function toggleDiaNuevoBloqueAdmin(diaId: number) {
    setEditNuevoBloqueDias((dias) => (dias.includes(diaId) ? dias.filter((d) => d !== diaId) : [...dias, diaId].sort()))
  }

  function agregarBloqueAdmin() {
    if (editNuevoBloqueDias.length === 0) return
    const desde = editNuevoBloqueTodoElDia ? '00:00' : editNuevoBloqueDesde
    const hasta = editNuevoBloqueTodoElDia ? '23:30' : editNuevoBloqueHasta
    if (hasta <= desde) return
    const nuevo: BloqueHorario = { id: `b${Date.now()}`, dias: editNuevoBloqueDias, desde, hasta, intervaloMin: editNuevoBloqueIntervalo }
    setEditHorarioBloques((b) => [...b, nuevo])
    setEditNuevoBloqueDias([])
    setEditNuevoBloqueTodoElDia(false)
  }

  function quitarBloqueAdmin(id: string) {
    setEditHorarioBloques((b) => b.filter((x) => x.id !== id))
  }

  async function guardarHorarioAdmin() {
    if (!profesionalEditandoId) return
    setGuardandoHorarioAdmin(true)
    setHorarioAdminGuardado(false)
    try {
      const res = await fetch(`/api/profesionales/${profesionalEditandoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify({ horarioTurnos: { bloques: editHorarioBloques } }),
      })
      const data = await res.json()
      if (data.error) { setErrorForm(data.error); return }
      setHorarioAdminGuardado(true)
      cargarProfesionales()
    } finally {
      setGuardandoHorarioAdmin(false)
    }
  }

  function borrarProfesional(id: string) {
    fetch(`/api/profesionales/${id}`, {
      method: 'DELETE',
      headers: { 'x-admin-password': password },
    }).then(() => cargarProfesionales())
  }

  async function crearCategoria(e: React.FormEvent) {
    e.preventDefault()
    if (!nuevaCategoriaLabel.trim()) return
    setGuardandoCategoria(true)
    setErrorCategorias('')
    try {
      const res = await fetch('/api/categorias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify({ accion: 'crear_categoria', label: nuevaCategoriaLabel.trim() }),
      })
      const data = await res.json()
      if (data.error) { setErrorCategorias(data.error); return }
      setNuevaCategoriaLabel('')
      recargarCategorias()
    } finally {
      setGuardandoCategoria(false)
    }
  }

  async function crearRubro(categoriaId: string) {
    if (!nuevoRubroLabel.trim()) return
    setGuardandoRubro(true)
    setErrorCategorias('')
    try {
      const res = await fetch('/api/categorias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify({ accion: 'crear_rubro', categoriaId, label: nuevoRubroLabel.trim() }),
      })
      const data = await res.json()
      if (data.error) { setErrorCategorias(data.error); return }
      setNuevoRubroLabel('')
      setCategoriaAbierta(null)
      recargarCategorias()
    } finally {
      setGuardandoRubro(false)
    }
  }

  async function moverRubro(rubroId: string, categoriaId: string) {
    setErrorCategorias('')
    const res = await fetch('/api/categorias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
      body: JSON.stringify({ accion: 'mover_rubro', rubroId, categoriaId }),
    })
    const data = await res.json()
    if (data.error) { setErrorCategorias(data.error); return }
    recargarCategorias()
  }

  async function renombrarCategoria(categoriaId: string) {
    if (!nuevoNombreCategoria.trim()) return
    setErrorCategorias('')
    const res = await fetch('/api/categorias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
      body: JSON.stringify({ accion: 'renombrar_categoria', categoriaId, label: nuevoNombreCategoria.trim() }),
    })
    const data = await res.json()
    if (data.error) { setErrorCategorias(data.error); return }
    setRenombrandoCategoriaId(null)
    setNuevoNombreCategoria('')
    recargarCategorias()
  }

  async function crearCategoriaProducto(e: React.FormEvent) {
    e.preventDefault()
    if (!nuevaCategoriaProductoLabel.trim()) return
    setGuardandoCategoriaProducto(true)
    setErrorCategoriasProductos('')
    try {
      const res = await fetch('/api/categorias-productos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify({ accion: 'crear_categoria', label: nuevaCategoriaProductoLabel.trim() }),
      })
      const data = await res.json()
      if (data.error) { setErrorCategoriasProductos(data.error); return }
      setNuevaCategoriaProductoLabel('')
      recargarCategoriasProductos()
    } finally {
      setGuardandoCategoriaProducto(false)
    }
  }

  async function crearRubroProducto(categoriaId: string) {
    if (!nuevoRubroProductoLabel.trim()) return
    setGuardandoRubroProducto(true)
    setErrorCategoriasProductos('')
    try {
      const res = await fetch('/api/categorias-productos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify({ accion: 'crear_rubro', categoriaId, label: nuevoRubroProductoLabel.trim() }),
      })
      const data = await res.json()
      if (data.error) { setErrorCategoriasProductos(data.error); return }
      setNuevoRubroProductoLabel('')
      setCategoriaProductoAbierta(null)
      recargarCategoriasProductos()
    } finally {
      setGuardandoRubroProducto(false)
    }
  }

  async function moverRubroProducto(rubroId: string, categoriaId: string) {
    setErrorCategoriasProductos('')
    const res = await fetch('/api/categorias-productos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
      body: JSON.stringify({ accion: 'mover_rubro', rubroId, categoriaId }),
    })
    const data = await res.json()
    if (data.error) { setErrorCategoriasProductos(data.error); return }
    recargarCategoriasProductos()
  }

  async function renombrarCategoriaProducto(categoriaId: string) {
    if (!nuevoNombreCategoriaProducto.trim()) return
    setErrorCategoriasProductos('')
    const res = await fetch('/api/categorias-productos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
      body: JSON.stringify({ accion: 'renombrar_categoria', categoriaId, label: nuevoNombreCategoriaProducto.trim() }),
    })
    const data = await res.json()
    if (data.error) { setErrorCategoriasProductos(data.error); return }
    setRenombrandoCategoriaProductoId(null)
    setNuevoNombreCategoriaProducto('')
    recargarCategoriasProductos()
  }

  function cambiarEstadoProfesional(
    id: string,
    estado: 'aprobado' | 'rechazado' | 'info_solicitada' | 'pendiente_revision',
    notaAdmin?: string
  ) {
    fetch(`/api/profesionales/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
      body: JSON.stringify(notaAdmin !== undefined ? { estado, notaAdmin } : { estado }),
    }).then(() => cargarProfesionales())
  }

  // Confirma que el pago de la membresía Premium realmente llegó (lo
  // revisás vos a mano contra el banco/QR, como con los pedidos de
  // productos) — activa Premium y extiende la vigencia 30 días desde
  // hoy, o desde la vigencia actual si todavía no había vencido.
  function confirmarPagoPremium(p: { id: string; planVigenciaHasta?: string | null }) {
    fetch(`/api/profesionales/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
      body: JSON.stringify({
        plan: 'premium',
        planEstadoPago: 'ninguno',
        planVigenciaHasta: calcularNuevaVigencia(p.planVigenciaHasta),
      }),
    }).then(() => cargarProfesionales())
  }

  function rechazarPagoPremium(id: string) {
    fetch(`/api/profesionales/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
      body: JSON.stringify({ planEstadoPago: 'ninguno' }),
    }).then(() => cargarProfesionales())
  }

  if (!autenticado) {
    return (
      <div className="max-w-[360px] mx-auto px-5 py-20">
        <div className="font-display text-xl font-bold text-ink mb-4">Panel de administración</div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Contraseña de administrador"
          className="w-full px-3.5 py-2.5 rounded-lg border border-line font-body text-sm mb-3"
          onKeyDown={(e) => e.key === 'Enter' && entrar(password)}
        />
        <button
          onClick={() => entrar(password)}
          disabled={cargando}
          className="w-full py-2.5 rounded-lg border-none bg-ink text-white font-body text-sm font-semibold"
        >
          {cargando ? 'Entrando...' : 'Entrar'}
        </button>
        {error && <div className="font-body text-xs text-maroon mt-3">{error}</div>}
      </div>
    )
  }


  async function cargarUsuarios() {
    setCargandoUsuarios(true)
    try {
      const res = await fetch('/api/admin/usuarios', {
        headers: { 'x-admin-password': password }
      })
      const data = await res.json()
      setUsuarios(data.usuarios || [])
    } finally { setCargandoUsuarios(false) }
  }

  async function toggleUsuario(uid: string, disabled: boolean) {
    const accion = disabled ? 'pausar' : 'reactivar'
    if (!confirm(`¿${accion.charAt(0).toUpperCase() + accion.slice(1)} este usuario?`)) return
    await fetch('/api/admin/usuarios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
      body: JSON.stringify({ uid, disabled, nota: notaUsuario[uid] || '' })
    })
    setUsuarios(prev => prev.map(u => u.uid === uid ? { ...u, disabled } : u))
  }

  async function eliminarUsuario(uid: string, email: string) {
    if (!confirm(`¿ELIMINAR PERMANENTEMENTE el usuario ${email}? Esta acción no se puede deshacer.`)) return
    if (!confirm('Confirmá una vez más. Se eliminarán todos sus datos.')) return
    await fetch('/api/admin/usuarios', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
      body: JSON.stringify({ uid })
    })
    setUsuarios(prev => prev.filter(u => u.uid !== uid))
  }


  return (
    <div className="max-w-[640px] mx-auto px-5 py-8">
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-panel border border-line rounded-xl p-3.5">
          <div className="font-body text-[11px] text-inksoft">Pedidos</div>
          <div className="font-display text-2xl font-bold text-ink">{resumen.pedidosTotal}</div>
        </div>
        <div className="bg-panel border border-line rounded-xl p-3.5">
          <div className="font-body text-[11px] text-inksoft">En proceso</div>
          <div className="font-display text-2xl font-bold text-ink">{resumen.pedidosPagados}</div>
        </div>
        <div className="bg-panel border border-line rounded-xl p-3.5">
          <div className="font-body text-[11px] text-inksoft">Productos activos</div>
          <div className="font-display text-2xl font-bold text-ink">{resumen.productosActivos}</div>
        </div>
        <div className="bg-panel border border-line rounded-xl p-3.5">
          <div className="font-body text-[11px] text-inksoft">Premium</div>
          <div className="font-display text-2xl font-bold text-ink">{resumen.productosPremium}</div>
        </div>
      </div>

      <div className="flex gap-2 mb-6 border-b border-line flex-wrap">
        <button
          onClick={() => setTab('pedidos')}
          className={`px-4 py-2.5 font-body text-sm font-semibold border-b-2 ${tab === 'pedidos' ? 'border-maroon text-ink' : 'border-transparent text-inksoft'}`}
        >
          Pedidos
        </button>
        <button
          onClick={() => setTab('productos')}
          className={`px-4 py-2.5 font-body text-sm font-semibold border-b-2 ${tab === 'productos' ? 'border-maroon text-ink' : 'border-transparent text-inksoft'}`}
        >
          Productos
        </button>
        <button
          onClick={() => setTab('servicios')}
          className={`px-4 py-2.5 font-body text-sm font-semibold border-b-2 ${tab === 'servicios' ? 'border-maroon text-ink' : 'border-transparent text-inksoft'}`}
        >
          Servicios profesionales
          {profesionales.filter((p) => p.estado === 'pendiente_revision').length > 0 && (
            <span className="ml-1.5 inline-block bg-ochre text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {profesionales.filter((p) => p.estado === 'pendiente_revision').length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('categorias')}
          className={`px-4 py-2.5 font-body text-sm font-semibold border-b-2 ${tab === 'categorias' ? 'border-maroon text-ink' : 'border-transparent text-inksoft'}`}
        >
          Categorías
        </button>
        <button
          onClick={() => setTab('categorias-productos')}
          className={`px-4 py-2.5 font-body text-sm font-semibold border-b-2 ${tab === 'categorias-productos' ? 'border-maroon text-ink' : 'border-transparent text-inksoft'}`}
        >
          Categorías de productos
        </button>
        <button
          onClick={() => { setTab('metricas'); if (!metricas) cargarMetricas() }}
          className={`px-4 py-2.5 font-body text-sm font-semibold border-b-2 ${tab === 'metricas' ? 'border-maroon text-ink' : 'border-transparent text-inksoft'}`}
        >
          Métricas
        </button>
        <button
          onClick={() => { setTab('usuarios'); if (usuarios.length === 0) cargarUsuarios() }}
          className={`px-4 py-2.5 font-body text-sm font-semibold border-b-2 ${tab === 'usuarios' ? 'border-maroon text-ink' : 'border-transparent text-inksoft'}`}
        >
          Usuarios
        </button>
      </div>

      {tab === 'pedidos' && (
        <div>
          {pedidos.length === 0 && <div className="font-body text-sm text-inksoft">Todavía no hay pedidos.</div>}
          {pedidos.map((p) => {
            const estado = ESTADOS_LABEL[p.estado] || { texto: p.estado, color: 'text-inksoft' }
            return (
              <div key={p.id} className="bg-panel border border-line rounded-lg p-4 mb-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-body text-sm font-medium text-ink">Pedido #{p.id.slice(0, 6)}</div>
                    <div className="font-body text-xs text-inksoft">{p.items?.length || 0} producto(s) · {bs(p.total)}</div>
                    <div className="font-body text-[11px] text-inksoft mt-1">
                      {p.zonaEntrega || 'Sin zona'} · {p.direccion ? `Entrega: ${p.direccion}` : 'Sin dirección'}
                    </div>
                    <div className={`font-body text-xs font-semibold ${estado.color}`}>{estado.texto}</div>
                  </div>
                  {p.estado !== 'pagado' && p.estado !== 'en_preparacion' && p.estado !== 'en_entrega' && p.estado !== 'entregado' && p.estado !== 'cancelado' && (
                    <button
                      onClick={() => confirmarPago(p.id)}
                      className="px-3.5 py-2 rounded-md border-none bg-teal text-white font-body text-xs font-semibold shrink-0"
                    >
                      Confirmar pago
                    </button>
                  )}
                </div>

                {p.estado === 'pagado' && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => cambiarEstadoPedido(p.id, 'en_preparacion')} className="px-2.5 py-1.5 rounded-md border border-line font-body text-[11px]">En preparación</button>
                    <button type="button" onClick={() => cambiarEstadoPedido(p.id, 'en_entrega')} className="px-2.5 py-1.5 rounded-md border border-line font-body text-[11px]">En entrega</button>
                    <button type="button" onClick={() => cambiarEstadoPedido(p.id, 'entregado')} className="px-2.5 py-1.5 rounded-md border border-line font-body text-[11px]">Entregado</button>
                    <button type="button" onClick={() => cambiarEstadoPedido(p.id, 'cancelado')} className="px-2.5 py-1.5 rounded-md border border-line font-body text-[11px] text-maroon">Cancelar</button>
                  </div>
                )}

                {p.estado === 'en_preparacion' && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => cambiarEstadoPedido(p.id, 'en_entrega')} className="px-2.5 py-1.5 rounded-md border border-line font-body text-[11px]">Enviar</button>
                    <button type="button" onClick={() => cambiarEstadoPedido(p.id, 'cancelado')} className="px-2.5 py-1.5 rounded-md border border-line font-body text-[11px] text-maroon">Cancelar</button>
                  </div>
                )}

                {p.estado === 'en_entrega' && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => cambiarEstadoPedido(p.id, 'entregado')} className="px-2.5 py-1.5 rounded-md border border-line font-body text-[11px]">Marcar entregado</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {tab === 'productos' && (
        <div>
          <div className="font-body text-sm font-semibold text-ink mb-3">Moderación de productos</div>
          {productos.length === 0 && <div className="font-body text-sm text-inksoft">Todavía no hay productos.</div>}
          {[...productos]
            .sort((a, b) => {
              const orden: Record<string, number> = { alto: 0, medio: 1, bajo: 2 }
              const oa = orden[a.moderacionIA?.riesgo] ?? 3
              const ob = orden[b.moderacionIA?.riesgo] ?? 3
              return oa - ob
            })
            .map((p) => (
            <div key={p.id} className="bg-panel border border-line rounded-lg p-3.5 mb-3 flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-panelalt flex items-center justify-center overflow-hidden shrink-0">
                {p.thumbUrl || p.imagenUrl ? <img src={p.thumbUrl || p.imagenUrl} alt={p.nombre} loading="lazy" decoding="async" className="w-full h-full object-cover" /> : <span className="font-body text-[10px] text-inksoft">IMG</span>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-body text-sm font-medium text-ink truncate">{p.nombre}</div>
                <div className="font-body text-xs text-inksoft">{p.vendedor || 'Vendedor'} · {labelPublicoProducto(p.publico)} · {buscarRubroProducto(p.rubro)?.label || p.categoria || 'Sin rubro'} · Bs {Number(p.precio || 0).toLocaleString('es-BO')}</div>
                <div className="font-body text-[11px] text-inksoft mt-1">Estado: {p.estado || 'activo'}</div>
                <BadgeRiesgoIA moderacionIA={p.moderacionIA} />
              </div>
              <div className="flex gap-2 flex-wrap justify-end">
                <button type="button" onClick={() => cambiarEstadoProducto(p.id, 'activo')} className="px-2 py-1 rounded-md border border-line font-body text-[11px]">Activo</button>
                <button type="button" onClick={() => cambiarEstadoProducto(p.id, 'pendiente')} className="px-2 py-1 rounded-md border border-line font-body text-[11px]">Pendiente</button>
                <button type="button" onClick={() => cambiarEstadoProducto(p.id, 'oculto')} className="px-2 py-1 rounded-md border border-line font-body text-[11px]">Ocultar</button>
                <button type="button" onClick={() => cambiarEstadoProducto(p.id, 'rechazado')} className="px-2 py-1 rounded-md border border-line font-body text-[11px] text-maroon">Rechazar</button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!confirm('¿Borrar este producto definitivamente?')) return
                      fetch(`/api/productos/${p.id}`, {
                        method: 'DELETE',
                        headers: { 'x-admin-password': password },
                      }).then(() => cargarProductos())
                    }}
                    className="px-2 py-1 rounded-md border border-line font-body text-[11px] text-maroon"
                  >
                    Borrar
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const nuevoNombre = prompt('Nuevo nombre', p.nombre || '')
                      if (nuevoNombre === null) return
                      const nuevoPrecio = prompt('Nuevo precio (Bs)', String(p.precio || ''))
                      if (nuevoPrecio === null) return
                      fetch(`/api/productos/${p.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
                        body: JSON.stringify({ nombre: nuevoNombre, precio: Number(nuevoPrecio) }),
                      }).then(() => cargarProductos())
                    }}
                    className="px-2 py-1 rounded-md border border-line font-body text-[11px]"
                  >
                    Editar
                  </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'servicios' && (
        <div>
          <form onSubmit={publicarProfesional} className="bg-panel border border-line rounded-xl p-5 mb-8">
            <div className="flex items-center justify-between mb-3">
              <div className="font-body text-sm font-semibold text-ink">
                {profesionalEditandoId ? 'Editando profesional' : 'Nuevo profesional'}
              </div>
              {profesionalEditandoId && (
                <button
                  type="button"
                  onClick={cancelarEdicionProfesional}
                  className="font-body text-xs text-inksoft underline"
                >
                  Cancelar edición
                </button>
              )}
            </div>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre o nombre del negocio"
              className="w-full px-3.5 py-2.5 rounded-lg border border-line font-body text-sm mb-3"
            />
            <div className="grid grid-cols-2 gap-3 mb-3">
              <select
                value={categoriaSel}
                onChange={(e) => {
                  const nuevaCategoria = e.target.value
                  setCategoriaSel(nuevaCategoria)
                  const cat = categorias.find((c) => c.id === nuevaCategoria)
                  setRubro(cat?.rubros[0]?.id || 'otro')
                }}
                className="px-3.5 py-2.5 rounded-lg border border-line font-body text-sm bg-panel"
              >
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
              <select
                value={rubro}
                onChange={(e) => setRubro(e.target.value)}
                className="px-3.5 py-2.5 rounded-lg border border-line font-body text-sm bg-panel"
              >
                {(categorias.find((c) => c.id === categoriaSel)?.rubros || []).map((r) => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>
            </div>
            <div className="font-body text-[11px] text-inksoft mb-3 -mt-2">
              ¿No está el rubro que buscás? Agregalo desde la pestaña "Categorías" y va a aparecer acá.
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <select
                value={plan}
                onChange={(e) => setPlan(e.target.value as 'basico' | 'premium')}
                className="px-3.5 py-2.5 rounded-lg border border-line font-body text-sm bg-panel"
              >
                <option value="basico">Plan básico</option>
                <option value="premium">Plan premium (destacado)</option>
              </select>
            </div>
            <input
              value={especialidad}
              onChange={(e) => setEspecialidad(e.target.value)}
              placeholder="Especialidad (opcional, ej: Médico general - Ecografista)"
              className="w-full px-3.5 py-2.5 rounded-lg border border-line font-body text-sm mb-3"
            />
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Descripción breve"
              rows={2}
              className="w-full px-3.5 py-2.5 rounded-lg border border-line font-body text-sm mb-3"
            />

            <div className="mb-3">
              <div className="font-body text-xs text-inksoft mb-1.5">Foto (opcional)</div>
              <div className="flex items-center gap-3 flex-wrap">
                {imagenUrl && (
                  <img
                    src={imagenUrl}
                    alt="Vista previa"
                    className="w-14 h-14 object-cover rounded-lg border border-line"
                  />
                )}
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => subirImagenProfesional(e.target.files?.[0] || null)}
                    disabled={subiendoImagen}
                    className="font-body text-xs"
                  />
                  {subiendoImagen && <div className="font-body text-xs text-maroon mt-1">Subiendo imagen...</div>}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <input
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                type="number"
                placeholder="Precio en Bs (opcional)"
                className="px-3.5 py-2.5 rounded-lg border border-line font-body text-sm"
              />
              <input
                value={experiencia}
                onChange={(e) => setExperiencia(e.target.value)}
                placeholder="Experiencia (ej: 20 años)"
                className="px-3.5 py-2.5 rounded-lg border border-line font-body text-sm"
              />
            </div>
            <div className="font-body text-[11px] text-inksoft mb-3 -mt-2">
              Si dejás el precio vacío, no se muestra ningún precio (hasta que el profesional lo pase por WhatsApp).
            </div>

            <input
              value={zona}
              onChange={(e) => setZona(e.target.value)}
              placeholder="Zona / barrio (ej: Sopocachi, La Paz)"
              className="w-full px-3.5 py-2.5 rounded-lg border border-line font-body text-sm mb-3"
            />
            <input
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              placeholder="Dirección (opcional, ej: Fortunato Gumiel)"
              className="w-full px-3.5 py-2.5 rounded-lg border border-line font-body text-sm mb-3"
            />
            <div className="grid grid-cols-2 gap-3 mb-3">
              <input
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="Latitud (opcional)"
                className="px-3.5 py-2.5 rounded-lg border border-line font-body text-sm"
              />
              <input
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                placeholder="Longitud (opcional)"
                className="px-3.5 py-2.5 rounded-lg border border-line font-body text-sm"
              />
            </div>
            <input
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="WhatsApp (ej: 71234567, sin +591)"
              className="w-full px-3.5 py-2.5 rounded-lg border border-line font-body text-sm mb-3"
            />
            <input
              value={emailProfesional}
              onChange={(e) => setEmailProfesional(e.target.value)}
              type="email"
              placeholder="Email (opcional)"
              className="w-full px-3.5 py-2.5 rounded-lg border border-line font-body text-sm mb-3"
            />
            <input
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              placeholder="Instagram u otra red social (opcional)"
              className="w-full px-3.5 py-2.5 rounded-lg border border-line font-body text-sm mb-3"
            />
            <div className="flex gap-2 mb-4 flex-wrap">
              {ICONOS_SERVICIO.map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIcono(i)}
                  className={`w-11 h-11 rounded-lg border flex items-center justify-center ${
                    icono === i ? 'border-maroon bg-maroonsoft text-maroon' : 'border-line text-inksoft'
                  }`}
                >
                  <ServiceIcon kind={i} size={20} />
                </button>
              ))}
            </div>
            {profesionalEditandoId && plan === 'premium' && (
              <div className="bg-panelalt rounded-lg p-3 mb-4">
                <div className="font-body text-xs font-semibold text-ink mb-2">Agenda de turnos (Premium)</div>
                <div className="font-body text-[11px] text-inksoft mb-2">
                  Bloques por día — ej. "Lunes a viernes, 19 a 21" y "Sábados, 9 a 14" son dos bloques distintos.
                </div>
                {editHorarioBloques.length > 0 && (
                  <div className="flex flex-col gap-1.5 mb-3">
                    {editHorarioBloques.map((b) => (
                      <div key={b.id} className="flex items-center justify-between gap-2 bg-panel rounded-md px-2.5 py-2">
                        <div className="font-body text-xs text-ink">
                          <strong>{b.dias.map((d) => DIAS_SEMANA[d].corto).join(', ')}</strong> · {b.desde}–{b.hasta} · {INTERVALOS_TURNO.find((i) => i.min === b.intervaloMin)?.label || `cada ${b.intervaloMin} min`}
                        </div>
                        <button type="button" onClick={() => quitarBloqueAdmin(b.id)} className="text-inksoft border-none bg-transparent leading-none shrink-0">✕</button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-1.5 flex-wrap mb-2">
                  {DIAS_SEMANA.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => toggleDiaNuevoBloqueAdmin(d.id)}
                      className={`px-2.5 py-1.5 rounded-md border font-body text-xs font-medium ${
                        editNuevoBloqueDias.includes(d.id) ? 'border-maroon bg-maroonsoft text-maroon' : 'border-line bg-panel text-inksoft'
                      }`}
                    >
                      {d.corto}
                    </button>
                  ))}
                </div>

                <label className="flex items-center gap-1.5 mb-2">
                  <input type="checkbox" checked={editNuevoBloqueTodoElDia} onChange={(e) => setEditNuevoBloqueTodoElDia(e.target.checked)} />
                  <span className="font-body text-xs text-ink">Todo el día</span>
                </label>

                {!editNuevoBloqueTodoElDia && (
                  <div className="flex gap-2 mb-2 items-center">
                    <input
                      type="time"
                      value={editNuevoBloqueDesde}
                      onChange={(e) => setEditNuevoBloqueDesde(e.target.value)}
                      className="px-3 py-2 rounded-lg border border-line font-body text-sm"
                    />
                    <span className="font-body text-xs text-inksoft">a</span>
                    <input
                      type="time"
                      value={editNuevoBloqueHasta}
                      onChange={(e) => setEditNuevoBloqueHasta(e.target.value)}
                      className="px-3 py-2 rounded-lg border border-line font-body text-sm"
                    />
                  </div>
                )}

                <select
                  value={editNuevoBloqueIntervalo}
                  onChange={(e) => setEditNuevoBloqueIntervalo(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-line font-body text-sm bg-panel mb-2"
                >
                  {INTERVALOS_TURNO.map((i) => (
                    <option key={i.min} value={i.min}>{i.label}</option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={agregarBloqueAdmin}
                  disabled={editNuevoBloqueDias.length === 0}
                  className="w-full py-2 rounded-lg border border-line font-body text-xs text-ink disabled:opacity-50 mb-3"
                >
                  + Agregar bloque
                </button>

                <button
                  type="button"
                  onClick={guardarHorarioAdmin}
                  disabled={guardandoHorarioAdmin}
                  className="px-3.5 py-2 rounded-lg border-none bg-teal text-white font-body text-xs font-semibold disabled:opacity-60"
                >
                  {guardandoHorarioAdmin ? 'Guardando...' : 'Guardar agenda'}
                </button>
                {horarioAdminGuardado && <span className="font-body text-[11px] text-teal ml-2">Guardado ✓</span>}
                <div className="font-body text-[11px] text-inksoft mt-2">
                  Esto es lo mismo que el profesional puede cargar solo desde su perfil — se guarda al toque, no hace falta tocar "Guardar cambios" de abajo.
                </div>
              </div>
            )}

            {errorForm && <div className="font-body text-xs text-maroon mb-3">{errorForm}</div>}
            <button
              type="submit"
              disabled={publicando || subiendoImagen}
              className="w-full py-2.5 rounded-lg border-none bg-maroon text-white font-body text-sm font-semibold"
            >
              {publicando ? (profesionalEditandoId ? 'Guardando...' : 'Publicando...') : (profesionalEditandoId ? 'Guardar cambios' : 'Publicar profesional')}
            </button>
          </form>

          {profesionales.filter((p) => p.estado === 'pendiente_revision').length > 0 && (
            <div className="mb-8">
              <div className="font-body text-sm font-semibold text-ochre mb-3">
                Solicitudes pendientes de revisión ({profesionales.filter((p) => p.estado === 'pendiente_revision').length})
              </div>
              {[...profesionales]
                .filter((p) => p.estado === 'pendiente_revision')
                .sort((a, b) => {
                  const orden: Record<string, number> = { alto: 0, medio: 1, bajo: 2 }
                  const oa = orden[a.moderacionIA?.riesgo] ?? 3
                  const ob = orden[b.moderacionIA?.riesgo] ?? 3
                  return oa - ob
                })
                .map((p) => (
                <div key={p.id} className="bg-panel border border-ochre rounded-lg p-4 mb-3">
                  <div className="font-body text-sm font-medium text-ink mb-1">{p.nombre}</div>
                  <div className="font-body text-xs text-inksoft mb-1">
                    {buscarRubro(p.rubro)?.label} · {p.zona || 'sin zona'} · WhatsApp: {p.whatsapp}
                    {p.email && <> · Email: {p.email}</>}
                  </div>
                  {p.descripcion && <div className="font-body text-xs text-ink mb-2">{p.descripcion}</div>}
                  <div className="font-body text-[11px] text-inksoft mb-2">
                    {p.precio ? `Bs ${Number(p.precio).toLocaleString('es-BO')}` : 'Precio a convenir'}
                    {p.experiencia && ` · Experiencia: ${p.experiencia}`}
                  </div>
                  <BadgeRiesgoIA moderacionIA={p.moderacionIA} />

                  {pidiendoInfoId === p.id ? (
                    <div className="mt-3">
                      <textarea
                        value={notaPidiendoInfo}
                        onChange={(e) => setNotaPidiendoInfo(e.target.value)}
                        placeholder="¿Qué le pediste? (ej: le pedí una foto más clara, quedé de escribirle el viernes)"
                        rows={2}
                        className="w-full px-3 py-2 rounded-md border border-line font-body text-xs mb-2"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            cambiarEstadoProfesional(p.id, 'info_solicitada', notaPidiendoInfo)
                            setPidiendoInfoId(null)
                            setNotaPidiendoInfo('')
                          }}
                          className="px-3.5 py-1.5 rounded-md border-none bg-ochre text-white font-body text-xs font-semibold"
                        >
                          Guardar y marcar en espera
                        </button>
                        <button
                          onClick={() => { setPidiendoInfoId(null); setNotaPidiendoInfo('') }}
                          className="px-3.5 py-1.5 rounded-md border border-line font-body text-xs text-inksoft"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2 mt-3 flex-wrap">
                      <button
                        onClick={() => cambiarEstadoProfesional(p.id, 'aprobado')}
                        className="px-3.5 py-1.5 rounded-md border-none bg-teal text-white font-body text-xs font-semibold"
                      >
                        Aprobar y publicar
                      </button>
                      <button
                        onClick={() => { setPidiendoInfoId(p.id); setNotaPidiendoInfo(p.notaAdmin || '') }}
                        className="px-3.5 py-1.5 rounded-md border border-ochre font-body text-xs text-ochre"
                      >
                        Pedir más info
                      </button>
                      <button
                        onClick={() => abrirEditarProfesional(p)}
                        className="px-3.5 py-1.5 rounded-md border border-line font-body text-xs text-teal"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => cambiarEstadoProfesional(p.id, 'rechazado')}
                        className="px-3.5 py-1.5 rounded-md border border-line font-body text-xs text-maroon"
                      >
                        Rechazar
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {profesionales.filter((p) => p.estado === 'info_solicitada').length > 0 && (
            <div className="mb-8">
              <div className="font-body text-sm font-semibold text-indigo-600 mb-3">
                ⏳ Esperando respuesta ({profesionales.filter((p) => p.estado === 'info_solicitada').length})
              </div>
              {profesionales
                .filter((p) => p.estado === 'info_solicitada')
                .map((p) => (
                <div key={p.id} className="bg-panel border border-indigo-200 rounded-lg p-4 mb-3">
                  <div className="font-body text-sm font-medium text-ink mb-1">{p.nombre}</div>
                  <div className="font-body text-xs text-inksoft mb-1">
                    {buscarRubro(p.rubro)?.label} · {p.zona || 'sin zona'} · WhatsApp: {p.whatsapp}
                    {p.email && <> · Email: {p.email}</>}
                  </div>
                  {p.notaAdmin && (
                    <div className="font-body text-xs text-indigo-700 bg-indigo-50 rounded-md px-2.5 py-2 mb-2">
                      📝 {p.notaAdmin}
                    </div>
                  )}
                  {pidiendoInfoId === p.id ? (
                    <div className="mt-1">
                      <textarea
                        value={notaPidiendoInfo}
                        onChange={(e) => setNotaPidiendoInfo(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 rounded-md border border-line font-body text-xs mb-2"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            cambiarEstadoProfesional(p.id, 'info_solicitada', notaPidiendoInfo)
                            setPidiendoInfoId(null)
                            setNotaPidiendoInfo('')
                          }}
                          className="px-3.5 py-1.5 rounded-md border-none bg-indigo-600 text-white font-body text-xs font-semibold"
                        >
                          Actualizar nota
                        </button>
                        <button
                          onClick={() => { setPidiendoInfoId(null); setNotaPidiendoInfo('') }}
                          className="px-3.5 py-1.5 rounded-md border border-line font-body text-xs text-inksoft"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2 flex-wrap">
                      <a
                        href={`https://wa.me/${p.whatsapp}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3.5 py-1.5 rounded-md border border-line font-body text-xs text-teal"
                      >
                        💬 Escribirle de nuevo
                      </a>
                      <button
                        onClick={() => { setPidiendoInfoId(p.id); setNotaPidiendoInfo(p.notaAdmin || '') }}
                        className="px-3.5 py-1.5 rounded-md border border-indigo-200 font-body text-xs text-indigo-600"
                      >
                        Editar nota
                      </button>
                      <button
                        onClick={() => cambiarEstadoProfesional(p.id, 'aprobado')}
                        className="px-3.5 py-1.5 rounded-md border-none bg-teal text-white font-body text-xs font-semibold"
                      >
                        Aprobar y publicar
                      </button>
                      <button
                        onClick={() => abrirEditarProfesional(p)}
                        className="px-3.5 py-1.5 rounded-md border border-line font-body text-xs text-teal"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => cambiarEstadoProfesional(p.id, 'pendiente_revision')}
                        className="px-3.5 py-1.5 rounded-md border border-line font-body text-xs text-inksoft"
                      >
                        Volver a pendiente
                      </button>
                      <button
                        onClick={() => cambiarEstadoProfesional(p.id, 'rechazado')}
                        className="px-3.5 py-1.5 rounded-md border border-line font-body text-xs text-maroon"
                      >
                        Rechazar
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {profesionales.filter((p) => p.planEstadoPago === 'informado_pago').length > 0 && (
            <div className="mb-8">
              <div className="font-body text-sm font-semibold text-teal mb-3">
                💳 Pagos de membresía Premium por confirmar ({profesionales.filter((p) => p.planEstadoPago === 'informado_pago').length})
              </div>
              {profesionales
                .filter((p) => p.planEstadoPago === 'informado_pago')
                .map((p) => (
                <div key={p.id} className="bg-panel border border-teal rounded-lg p-4 mb-3">
                  <div className="font-body text-sm font-medium text-ink mb-1">{p.nombre}</div>
                  <div className="font-body text-xs text-inksoft mb-3">
                    WhatsApp: {p.whatsapp}
                    {p.planVigenciaHasta && new Date(p.planVigenciaHasta).getTime() > Date.now() && (
                      <> · Ya tiene Premium vigente hasta {new Date(p.planVigenciaHasta).toLocaleDateString('es-BO')} — confirmar esto se lo extiende 30 días más desde esa fecha</>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => confirmarPagoPremium(p)}
                      className="px-3.5 py-1.5 rounded-md border-none bg-teal text-white font-body text-xs font-semibold"
                    >
                      Confirmar pago recibido
                    </button>
                    <button
                      onClick={() => rechazarPagoPremium(p.id)}
                      className="px-3.5 py-1.5 rounded-md border border-line font-body text-xs text-maroon"
                    >
                      No llegó / rechazar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="font-body text-sm font-semibold text-ink mb-3">
            Publicados ({profesionales.filter((p) => !p.estado || p.estado === 'aprobado').length})
          </div>
          {[...profesionales]
            .filter((p) => !p.estado || p.estado === 'aprobado')
            .sort((a, b) => (b.clicsWhatsapp || 0) - (a.clicsWhatsapp || 0))
            .map((p) => (
            <div key={p.id} className="bg-panel border border-line rounded-lg p-3.5 mb-2.5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-panelalt flex items-center justify-center text-maroon shrink-0 overflow-hidden">
                {p.imagenUrl ? (
                  <img src={p.thumbUrl || p.imagenUrl} alt={p.nombre} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                ) : (
                  <ServiceIcon kind={p.icono} size={20} />
                )}
              </div>
              <div className="flex-1">
                <div className="font-body text-sm font-medium text-ink">{p.nombre}</div>
                <div className="font-body text-xs text-inksoft">
                  {buscarRubro(p.rubro)?.label} · {p.zona} · {p.plan === 'premium' ? 'Premium' : 'Básico'}
                </div>
                <div className="font-body text-[11px] text-inksoft mt-0.5">
                  👁 {p.vistas || 0} vistas · 💬 {p.clicsWhatsapp || 0} contactos
                </div>
              </div>
              <button
                onClick={() => abrirEditarProfesional(p)}
                className="font-body text-xs text-teal underline shrink-0"
              >
                Editar
              </button>
              <button
                onClick={() => borrarProfesional(p.id)}
                className="font-body text-xs text-maroon underline shrink-0"
              >
                Borrar
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === 'categorias' && (
        <div>
          <div className="font-body text-sm text-inksoft mb-4">
            Acá se arma el árbol Categoría → Rubro que se usa en el selector de /servicios y en el formulario de publicar servicio.
            Salud, Ingeniería, etc. vienen con rubros de base; podés agregar categorías o rubros nuevos, y mover un rubro si quedó en la categoría que no corresponde.
          </div>

          <form onSubmit={crearCategoria} className="bg-panel border border-line rounded-lg p-4 mb-6 flex gap-2 items-center">
            <input
              value={nuevaCategoriaLabel}
              onChange={(e) => setNuevaCategoriaLabel(e.target.value)}
              placeholder="Nombre de la categoría nueva (ej: Tecnología)"
              className="flex-1 px-3 py-2 rounded-md border border-line font-body text-sm"
            />
            <button
              type="submit"
              disabled={guardandoCategoria}
              className="px-3.5 py-2 rounded-md border-none bg-maroon text-white font-body text-xs font-semibold shrink-0"
            >
              {guardandoCategoria ? 'Agregando...' : '+ Agregar categoría'}
            </button>
          </form>

          {errorCategorias && <div className="font-body text-xs text-maroon mb-4">{errorCategorias}</div>}

          {categorias.map((cat) => (
            <div key={cat.id} className="bg-panel border border-line rounded-lg p-4 mb-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                {renombrandoCategoriaId === cat.id ? (
                  <div className="flex gap-2 flex-1">
                    <input
                      value={nuevoNombreCategoria}
                      onChange={(e) => setNuevoNombreCategoria(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 rounded-md border border-line font-body text-sm"
                    />
                    <button onClick={() => renombrarCategoria(cat.id)} className="px-2.5 py-1.5 rounded-md border-none bg-teal text-white font-body text-xs font-semibold">
                      Guardar
                    </button>
                    <button onClick={() => { setRenombrandoCategoriaId(null); setNuevoNombreCategoria('') }} className="px-2.5 py-1.5 rounded-md border border-line font-body text-xs text-inksoft">
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="font-display text-base font-bold text-ink">{cat.label}</div>
                    <button
                      onClick={() => { setRenombrandoCategoriaId(cat.id); setNuevoNombreCategoria(cat.label) }}
                      className="font-body text-xs text-inksoft underline shrink-0"
                    >
                      Renombrar
                    </button>
                  </>
                )}
              </div>

              <div className="flex flex-col gap-1.5 mb-3">
                {cat.rubros.length === 0 && (
                  <div className="font-body text-xs text-inksoft">Todavía sin rubros.</div>
                )}
                {cat.rubros.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-2 bg-panelalt rounded-md px-2.5 py-1.5">
                    <span className="font-body text-sm text-ink">{r.label}</span>
                    <select
                      value={cat.id}
                      onChange={(e) => moverRubro(r.id, e.target.value)}
                      className="px-2 py-1 rounded-md border border-line font-body text-[11px] bg-panel shrink-0"
                      title="Mover este rubro a otra categoría"
                    >
                      {categorias.map((c2) => (
                        <option key={c2.id} value={c2.id}>{c2.label}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {categoriaAbierta === cat.id ? (
                <div className="flex gap-2">
                  <input
                    value={nuevoRubroLabel}
                    onChange={(e) => setNuevoRubroLabel(e.target.value)}
                    placeholder="Nombre del rubro (ej: Kinesiólogo)"
                    className="flex-1 px-2.5 py-1.5 rounded-md border border-line font-body text-sm"
                  />
                  <button
                    onClick={() => crearRubro(cat.id)}
                    disabled={guardandoRubro}
                    className="px-3 py-1.5 rounded-md border-none bg-teal text-white font-body text-xs font-semibold shrink-0"
                  >
                    Guardar
                  </button>
                  <button
                    onClick={() => { setCategoriaAbierta(null); setNuevoRubroLabel('') }}
                    className="px-3 py-1.5 rounded-md border border-line font-body text-xs text-inksoft shrink-0"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setCategoriaAbierta(cat.id); setNuevoRubroLabel('') }}
                  className="font-body text-xs text-maroon underline"
                >
                  + Agregar rubro en {cat.label}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'categorias-productos' && (
        <div>
          <div className="font-body text-sm text-inksoft mb-4">
            Acá se arma el árbol Categoría → Rubro que se usa para clasificar los productos (selector en /vender, filtros del catálogo y ficha del producto).
            Calzado, Ropa, Accesorios y Hogar vienen con rubros de base; podés agregar categorías o rubros nuevos, y mover un rubro si quedó en la categoría que no corresponde.
          </div>

          <form onSubmit={crearCategoriaProducto} className="bg-panel border border-line rounded-lg p-4 mb-6 flex gap-2 items-center">
            <input
              value={nuevaCategoriaProductoLabel}
              onChange={(e) => setNuevaCategoriaProductoLabel(e.target.value)}
              placeholder="Nombre de la categoría nueva (ej: Electrónica)"
              className="flex-1 px-3 py-2 rounded-md border border-line font-body text-sm"
            />
            <button
              type="submit"
              disabled={guardandoCategoriaProducto}
              className="px-3.5 py-2 rounded-md border-none bg-maroon text-white font-body text-xs font-semibold shrink-0"
            >
              {guardandoCategoriaProducto ? 'Agregando...' : '+ Agregar categoría'}
            </button>
          </form>

          {errorCategoriasProductos && <div className="font-body text-xs text-maroon mb-4">{errorCategoriasProductos}</div>}

          {categoriasProductos.map((cat) => (
            <div key={cat.id} className="bg-panel border border-line rounded-lg p-4 mb-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                {renombrandoCategoriaProductoId === cat.id ? (
                  <div className="flex gap-2 flex-1">
                    <input
                      value={nuevoNombreCategoriaProducto}
                      onChange={(e) => setNuevoNombreCategoriaProducto(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 rounded-md border border-line font-body text-sm"
                    />
                    <button onClick={() => renombrarCategoriaProducto(cat.id)} className="px-2.5 py-1.5 rounded-md border-none bg-teal text-white font-body text-xs font-semibold">
                      Guardar
                    </button>
                    <button onClick={() => { setRenombrandoCategoriaProductoId(null); setNuevoNombreCategoriaProducto('') }} className="px-2.5 py-1.5 rounded-md border border-line font-body text-xs text-inksoft">
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="font-display text-base font-bold text-ink">{cat.label}</div>
                    <button
                      onClick={() => { setRenombrandoCategoriaProductoId(cat.id); setNuevoNombreCategoriaProducto(cat.label) }}
                      className="font-body text-xs text-inksoft underline shrink-0"
                    >
                      Renombrar
                    </button>
                  </>
                )}
              </div>

              <div className="flex flex-col gap-1.5 mb-3">
                {cat.rubros.length === 0 && (
                  <div className="font-body text-xs text-inksoft">Todavía sin rubros.</div>
                )}
                {cat.rubros.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-2 bg-panelalt rounded-md px-2.5 py-1.5">
                    <span className="font-body text-sm text-ink">{r.label}</span>
                    <select
                      value={cat.id}
                      onChange={(e) => moverRubroProducto(r.id, e.target.value)}
                      className="px-2 py-1 rounded-md border border-line font-body text-[11px] bg-panel shrink-0"
                      title="Mover este rubro a otra categoría"
                    >
                      {categoriasProductos.map((c2) => (
                        <option key={c2.id} value={c2.id}>{c2.label}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {categoriaProductoAbierta === cat.id ? (
                <div className="flex gap-2">
                  <input
                    value={nuevoRubroProductoLabel}
                    onChange={(e) => setNuevoRubroProductoLabel(e.target.value)}
                    placeholder="Nombre del rubro (ej: Mochilas)"
                    className="flex-1 px-2.5 py-1.5 rounded-md border border-line font-body text-sm"
                  />
                  <button
                    onClick={() => crearRubroProducto(cat.id)}
                    disabled={guardandoRubroProducto}
                    className="px-3 py-1.5 rounded-md border-none bg-teal text-white font-body text-xs font-semibold shrink-0"
                  >
                    Guardar
                  </button>
                  <button
                    onClick={() => { setCategoriaProductoAbierta(null); setNuevoRubroProductoLabel('') }}
                    className="px-3 py-1.5 rounded-md border border-line font-body text-xs text-inksoft shrink-0"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setCategoriaProductoAbierta(cat.id); setNuevoRubroProductoLabel('') }}
                  className="font-body text-xs text-maroon underline"
                >
                  + Agregar rubro en {cat.label}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'metricas' && (
        <div>
          {cargandoMetricas && <div className="font-body text-sm text-inksoft">Cargando métricas...</div>}
          {!cargandoMetricas && metricas && !metricas.error && (
            <div>
              {metricas.flujoCaja && (
                <>
                  <div className="font-body text-sm font-semibold text-ink mb-1">💰 Flujo de caja — Premium de profesionales</div>
                  <div className="font-body text-[11px] text-inksoft mb-3">
                    Es el único ingreso real y verificado que recibe la plataforma — los pedidos del marketplace se cobran directo al vendedor por su propio QR, no pasan por tu cuenta. El histórico de pagos se empezó a registrar recién, así que "histórico" cuenta solo desde ahora en adelante.
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-5">
                    <div className="bg-panel border border-line rounded-lg p-3">
                      <div className="font-body text-[10px] text-inksoft mb-0.5">Pagos confirmados (histórico)</div>
                      <div className="font-display text-lg font-bold text-ink">{metricas.flujoCaja.pagosConfirmadosHistorico}</div>
                      <div className="font-body text-[11px] text-inksoft">{bs(metricas.flujoCaja.facturadoHistorico)}</div>
                    </div>
                    <div className="bg-panel border border-line rounded-lg p-3">
                      <div className="font-body text-[10px] text-inksoft mb-0.5">Pagos este mes</div>
                      <div className="font-display text-lg font-bold text-ink">{metricas.flujoCaja.pagosEsteMes}</div>
                      <div className="font-body text-[11px] text-inksoft">{bs(metricas.flujoCaja.facturadoEsteMes)}</div>
                    </div>
                    <div className="bg-panel border border-teal rounded-lg p-3">
                      <div className="font-body text-[10px] text-inksoft mb-0.5">Premium vigentes ahora</div>
                      <div className="font-display text-lg font-bold text-teal">{metricas.flujoCaja.premiumVigentesAhora}</div>
                      <div className="font-body text-[11px] text-inksoft">Tu ingreso recurrente actual</div>
                    </div>
                    <div className="bg-ochresoft border border-ochre rounded-lg p-3">
                      <div className="font-body text-[10px] text-inksoft mb-0.5">Pagos por confirmar</div>
                      <div className="font-display text-lg font-bold text-ink">{metricas.flujoCaja.porConfirmar}</div>
                      <div className="font-body text-[11px] text-inksoft">Dicen que ya pagaron — revisalos abajo, en "Servicios profesionales"</div>
                    </div>
                    <div className="bg-panel border border-line rounded-lg p-3">
                      <div className="font-body text-[10px] text-inksoft mb-0.5">Vencen en 7 días</div>
                      <div className="font-display text-lg font-bold text-ink">{metricas.flujoCaja.venciendoEn7Dias}</div>
                      <div className="font-body text-[11px] text-inksoft">Riesgo de no renovar</div>
                    </div>
                    <div className="bg-maroonsoft border border-maroon rounded-lg p-3">
                      <div className="font-body text-[10px] text-inksoft mb-0.5">Proyección próx. 30 días</div>
                      <div className="font-display text-lg font-bold text-maroon">{bs(metricas.flujoCaja.proyeccionProximos30Dias)}</div>
                      <div className="font-body text-[11px] text-inksoft">Si todos los vigentes renuevan</div>
                    </div>
                  </div>
                </>
              )}

              <div className="font-body text-sm font-semibold text-ink mb-1">Evolución en el tiempo</div>
              <div className="font-body text-[11px] text-inksoft mb-3">
                Visitas, vistas, clics y búsquedas se empiezan a contar día a día desde ahora — antes solo se guardaba un total acumulado, sin saber qué día. Pedidos, productos y profesionales publicados sí muestran toda la historia, porque ya tenían fecha guardada.
              </div>

              {metricas.comparativaSemanal && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                  {(
                    [
                      ['Visitas', metricas.comparativaSemanal.estaSemana.visitas, metricas.comparativaSemanal.cambioVisitas],
                      ['Pedidos', metricas.comparativaSemanal.estaSemana.pedidos, metricas.comparativaSemanal.cambioPedidos],
                      ['Facturado', metricas.comparativaSemanal.estaSemana.facturado, metricas.comparativaSemanal.cambioFacturado],
                    ] as [string, number, number | null][]
                  ).map(([label, valor, cambio]) => (
                    <div key={label} className="bg-panel border border-line rounded-lg p-3">
                      <div className="font-body text-[10px] text-inksoft mb-0.5">{label} · últimos 7 días</div>
                      <div className="font-display text-lg font-bold text-ink">
                        {label === 'Facturado' ? bs(valor) : valor.toLocaleString('es-BO')}
                      </div>
                      {cambio != null && (
                        <div className={`font-body text-[11px] font-semibold ${cambio >= 0 ? 'text-teal' : 'text-maroon'}`}>
                          {cambio >= 0 ? '↑' : '↓'} {Math.abs(cambio)}% vs. semana anterior
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="bg-panel border border-line rounded-lg p-3">
                    <div className="font-body text-[10px] text-inksoft mb-0.5">Conversión aprox. · últimos 7 días</div>
                    <div className="font-display text-lg font-bold text-ink">
                      {metricas.comparativaSemanal.estaSemana.visitas > 0
                        ? `${((metricas.comparativaSemanal.estaSemana.pedidos / metricas.comparativaSemanal.estaSemana.visitas) * 100).toFixed(1)}%`
                        : '—'}
                    </div>
                    <div className="font-body text-[11px] text-inksoft">Pedidos / visitas — si baja, el problema es más de conversión que de tráfico.</div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 mb-3 flex-wrap items-center">
                <div className="flex gap-1 bg-panelalt border border-line rounded-lg p-1">
                  {(['dia', 'mes', 'anio'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPeriodoMetricas(p)}
                      className={`px-3 py-1.5 rounded-md font-body text-xs font-semibold ${periodoMetricas === p ? 'bg-panel text-ink' : 'text-inksoft'}`}
                    >
                      {p === 'dia' ? 'Por día' : p === 'mes' ? 'Por mes' : 'Por año'}
                    </button>
                  ))}
                </div>
                <select
                  value={campoMetricas}
                  onChange={(e) => setCampoMetricas(e.target.value as keyof typeof CAMPOS_METRICAS)}
                  className="px-3 py-1.5 rounded-lg border border-line font-body text-xs bg-panel"
                >
                  {Object.entries(CAMPOS_METRICAS).map(([campo, info]) => (
                    <option key={campo} value={campo}>{info.label}</option>
                  ))}
                </select>
              </div>

              <div className="bg-panel border border-line rounded-xl p-4 mb-8">
                <GraficoBarras
                  datos={(
                    periodoMetricas === 'dia' ? metricas.serieDiaria
                    : periodoMetricas === 'mes' ? metricas.serieMensual
                    : metricas.serieAnual
                  ).map((p: any) => ({ clave: p.clave, valor: p[campoMetricas] || 0 }))}
                  color={CAMPOS_METRICAS[campoMetricas].color}
                  formatoEtiqueta={(clave) =>
                    periodoMetricas === 'dia' ? clave.slice(5).replace('-', '/')
                    : periodoMetricas === 'mes' ? clave
                    : clave
                  }
                />
              </div>

              {metricas.porDiaSemana?.length > 0 && (
                <>
                  <div className="font-body text-sm font-semibold text-ink mb-1">¿Qué día se mueve más?</div>
                  <div className="font-body text-[11px] text-inksoft mb-3">
                    Suma de toda la historia disponible, agrupada por día de la semana — para decidir, por ejemplo, qué día conviene publicar una oferta o subir precio de un servicio con más demanda.
                  </div>
                  <div className="bg-panel border border-line rounded-xl p-4 mb-8">
                    <GraficoBarras
                      datos={metricas.porDiaSemana.map((p: any) => ({ clave: p.clave, valor: p[campoMetricas] || 0 }))}
                      color={CAMPOS_METRICAS[campoMetricas].color}
                      formatoEtiqueta={(clave) => clave.slice(0, 3)}
                    />
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
                <div className="bg-panel border border-line rounded-xl p-4">
                  <div className="font-body text-[11px] text-inksoft mb-1">Usuarios registrados</div>
                  <div className="font-display text-2xl font-bold text-ink">
                    {metricas.usuariosTotal != null ? metricas.usuariosTotal : '—'}
                  </div>
                </div>
                <div className="bg-panel border border-line rounded-xl p-4">
                  <div className="font-body text-[11px] text-inksoft mb-1">Total facturado</div>
                  <div className="font-display text-2xl font-bold text-ink">
                    Bs {Number(metricas.pedidos?.totalFacturado || 0).toLocaleString('es-BO')}
                  </div>
                </div>
                <div className="bg-panel border border-line rounded-xl p-4">
                  <div className="font-body text-[11px] text-inksoft mb-1">Pedidos totales</div>
                  <div className="font-display text-2xl font-bold text-ink">{metricas.pedidos?.total ?? 0}</div>
                </div>
                <div className="bg-panel border border-line rounded-xl p-4">
                  <div className="font-body text-[11px] text-inksoft mb-1">Productos publicados</div>
                  <div className="font-display text-2xl font-bold text-ink">{metricas.productos?.total ?? 0}</div>
                </div>
                <div className="bg-panel border border-line rounded-xl p-4">
                  <div className="font-body text-[11px] text-inksoft mb-1">Profesionales aprobados</div>
                  <div className="font-display text-2xl font-bold text-ink">
                    {metricas.profesionales?.porEstado?.aprobado ?? 0}
                  </div>
                </div>
                <div className="bg-panel border border-line rounded-xl p-4">
                  <div className="font-body text-[11px] text-inksoft mb-1">Reseñas totales</div>
                  <div className="font-display text-2xl font-bold text-ink">{metricas.profesionales?.totalResenas ?? 0}</div>
                </div>
              </div>

              <div className="font-body text-sm font-semibold text-ink mb-3">Pedidos por estado</div>
              <div className="flex flex-wrap gap-2 mb-8">
                {Object.entries(metricas.pedidos?.porEstado || {}).map(([estado, cant]) => (
                  <div key={estado} className="bg-panelalt border border-line rounded-lg px-3 py-2">
                    <div className="font-body text-[11px] text-inksoft">{ESTADOS_LABEL[estado]?.texto || estado}</div>
                    <div className="font-display text-lg font-bold text-ink">{cant as number}</div>
                  </div>
                ))}
              </div>

              <div className="font-body text-sm font-semibold text-ink mb-3">Productos por estado</div>
              <div className="flex flex-wrap gap-2 mb-8">
                {Object.entries(metricas.productos?.porEstado || {}).map(([estado, cant]) => (
                  <div key={estado} className="bg-panelalt border border-line rounded-lg px-3 py-2">
                    <div className="font-body text-[11px] text-inksoft capitalize">{estado}</div>
                    <div className="font-display text-lg font-bold text-ink">{cant as number}</div>
                  </div>
                ))}
                <div className="bg-ochresoft border border-ochre rounded-lg px-3 py-2">
                  <div className="font-body text-[11px] text-inksoft">premium</div>
                  <div className="font-display text-lg font-bold text-ink">{metricas.productos?.premium ?? 0}</div>
                </div>
              </div>

              {metricas.productosMasVistos?.length > 0 && (
                <>
                  <div className="font-body text-sm font-semibold text-ink mb-3">Productos más vistos</div>
                  <div className="mb-8">
                    {metricas.productosMasVistos.map((p: any, i: number) => (
                      <div key={p.id} className="flex items-center justify-between py-2 border-b border-line">
                        <span className="font-body text-sm text-ink">{i + 1}. {p.nombre}</span>
                        <span className="font-body text-xs text-inksoft">{p.vistas} vistas</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-3 mb-8">
                <div className="bg-panel border border-line rounded-xl p-4">
                  <div className="font-body text-[11px] text-inksoft mb-1">Vistas de perfiles profesionales</div>
                  <div className="font-display text-2xl font-bold text-ink">{metricas.profesionales?.totalVistas ?? 0}</div>
                </div>
                <div className="bg-panel border border-line rounded-xl p-4">
                  <div className="font-body text-[11px] text-inksoft mb-1">Clics a WhatsApp (profesionales)</div>
                  <div className="font-display text-2xl font-bold text-ink">{metricas.profesionales?.totalClicsWhatsapp ?? 0}</div>
                </div>
              </div>

              {metricas.profesionalesMasClicWhatsapp?.length > 0 && (
                <>
                  <div className="font-body text-sm font-semibold text-ink mb-3">Profesionales con más contactos por WhatsApp</div>
                  <div className="mb-8">
                    {metricas.profesionalesMasClicWhatsapp.map((p: any, i: number) => (
                      <div key={p.id} className="flex items-center justify-between py-2 border-b border-line">
                        <span className="font-body text-sm text-ink">{i + 1}. {p.nombre}</span>
                        <span className="font-body text-xs text-inksoft">{p.clicsWhatsapp} clics · {p.vistas} vistas</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {metricas.categoriasMasBuscadas?.length > 0 && (
                <>
                  <div className="font-body text-sm font-semibold text-ink mb-1">Categorías y rubros más buscados</div>
                  <div className="font-body text-[11px] text-inksoft mb-3">
                    Para identificar nichos rentables — esto es lo que la gente filtra de verdad, no una suposición.
                  </div>
                  <div className="mb-4">
                    {metricas.categoriasMasBuscadas.map((c: any, i: number) => (
                      <div key={`${c.tipo}-${c.valor}`} className="flex items-center justify-between py-2 border-b border-line">
                        <span className="font-body text-sm text-ink">
                          {i + 1}. {c.valor} <span className="text-inksoft text-xs">({c.tipo === 'producto' ? 'producto' : 'servicio'})</span>
                        </span>
                        <span className="font-body text-xs text-inksoft">{c.clics} búsquedas</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className="font-body text-[11px] text-inksoft mt-4">
                Todos estos números salen de datos reales de Firestore y Firebase Auth — no hay estimaciones ni cifras infladas.
              </div>
            </div>
          )}
          {!cargandoMetricas && metricas?.error && (
            <div className="font-body text-sm text-maroon">{metricas.error}</div>
          )}
        </div>
      )}

      {tab === 'usuarios' && (
        <div>
          <input
            value={filtroUsuarios}
            onChange={(e) => setFiltroUsuarios(e.target.value)}
            placeholder="Buscar por email o nombre..."
            className="w-full px-3.5 py-2.5 rounded-lg border border-line font-body text-sm mb-4"
          />

          {cargandoUsuarios ? (
            <div className="font-body text-sm text-inksoft">Cargando usuarios...</div>
          ) : usuarios.length === 0 ? (
            <div className="font-body text-sm text-inksoft">No hay usuarios registrados todavía.</div>
          ) : (
            usuarios
              .filter((u) => {
                const q = filtroUsuarios.trim().toLowerCase()
                if (!q) return true
                return u.email.toLowerCase().includes(q) || (u.displayName || '').toLowerCase().includes(q)
              })
              .map((u) => (
                <div key={u.uid} className="bg-panel border border-line rounded-lg p-3.5 mb-2.5">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <div className="font-body text-sm font-medium text-ink truncate">{u.email || u.uid}</div>
                      {u.displayName && <div className="font-body text-xs text-inksoft">{u.displayName}</div>}
                      <div className="font-body text-[11px] text-inksoft mt-0.5">
                        {u.vendedor && <span className="mr-2">🛍️ Vende productos</span>}
                        {u.profesional && <span>🧰 Servicio profesional</span>}
                        {!u.vendedor && !u.profesional && <span>Sin publicaciones</span>}
                      </div>
                      <div className="font-body text-[11px] text-inksoft mt-0.5">
                        Registrado: {u.createdAt ? new Date(u.createdAt).toLocaleDateString('es-BO') : '—'}
                        {u.lastSignIn && <> · Último ingreso: {new Date(u.lastSignIn).toLocaleDateString('es-BO')}</>}
                      </div>
                    </div>
                    <span className={`shrink-0 font-body text-[11px] font-semibold px-2 py-0.5 rounded-full ${u.disabled ? 'bg-maroonsoft text-maroon' : 'bg-tealsoft text-teal'}`}>
                      {u.disabled ? 'Pausado' : 'Activo'}
                    </span>
                  </div>

                  <input
                    value={notaUsuario[u.uid] ?? ''}
                    onChange={(e) => setNotaUsuario((prev) => ({ ...prev, [u.uid]: e.target.value }))}
                    placeholder="Nota interna (opcional, ej: motivo de la pausa)"
                    className="w-full px-3 py-1.5 rounded-md border border-line font-body text-xs mb-2"
                  />

                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleUsuario(u.uid, !u.disabled)}
                      className={`px-3.5 py-1.5 rounded-md border-none font-body text-xs font-semibold text-white ${u.disabled ? 'bg-teal' : 'bg-ochre'}`}
                    >
                      {u.disabled ? 'Reactivar' : 'Pausar'}
                    </button>
                    <button
                      onClick={() => eliminarUsuario(u.uid, u.email)}
                      className="px-3.5 py-1.5 rounded-md border border-line font-body text-xs text-maroon"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))
          )}
        </div>
      )}
    </div>
  )
}