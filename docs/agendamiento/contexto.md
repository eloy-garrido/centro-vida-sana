# Sistema de agendamiento — contexto compartido

> Contexto vigente tras el cambio de alcance a agenda propia en Cloudflare. Sustituye la propuesta de integración con Google Calendar. Solo existe infraestructura bootstrap de pruebas, no un sistema de reservas implementado.

## Frontera obligatoria de infraestructura

Leer y cumplir [seguridad-cloudflare.md](seguridad-cloudflare.md) antes de usar MCP, Wrangler, SDK o APIs. Inventario verificado: [cloudflare-staging.md](cloudflare-staging.md).

- Cuenta permitida: `21c858ed53ec9083b6fcd89d18c27372`.
- Único Worker de pruebas: `vida-sana-reservas-staging`.
- Única D1 de pruebas: `vida-sana-reservas-staging`, UUID `3d91d453-2ef5-4601-80cf-27622a0787bf`.
- Binding: `DB` exclusivamente a ese UUID. Configuración: `infra/cloudflare-staging/wrangler.jsonc`.
- Sin DNS, dominio, rutas, URLs públicas, acceso a otros proyectos ni cambios de permisos/cuenta. `workers.dev` y previews permanecen deshabilitados.
- Cada mutación remota futura requiere aprobación acotada y coincidencia exacta del destino; discrepancia o ausencia de autorización = detenerse. No hay permiso general de desplegar o migrar.
- La credencial MCP no está técnicamente certificada como restringida a estos recursos. Esta frontera es obligatoria para los agentes, no una garantía IAM.

## Objetivo

Desarrollar una pasarela de reservas y un panel compartido del equipo, con Cloudflare D1 como fuente oficial de la agenda. Trabajar primero localmente y en recursos exclusivos de pruebas. Migrar el sitio/dominio de producción requiere una autorización posterior independiente.

## Flujo del paciente

1. Iniciar sesión con Google OAuth para obtener nombre y correo de la cuenta.
2. Confirmar o editar los datos de quien recibirá la atención: nombre, correo y RUT. La persona que reserva puede ser distinta del paciente.
3. Si ya existe una reserva previa asociada a la cuenta, precargar los datos disponibles sin impedir su edición.
4. Elegir profesional mediante tarjetas con fotografía y área:
   - Eduardo Lagos: acupuntura y medicina china.
   - Felipe Méndez: quiropraxia y kinesiología.
5. Consultar horas disponibles de la agenda propia del profesional y elegir una.
6. Revisar un resumen completo y confirmar con un botón de agendamiento.
7. Crear la reserva en D1 y mostrar confirmación en pantalla. Ofrecer al paciente y al equipo un enlace para añadir una copia a su calendario personal; no enviar correos.

Cada profesional tiene una agenda lógica distinta dentro de la aplicación. Sus cupos son independientes: ambos pueden atender a diferentes pacientes en el mismo horario.

## Decisiones confirmadas por el usuario

- No hay calendarios clínicos centrales en Google ni API de Calendar en el MVP. `centrovida.sanaaustral@gmail.com` pertenecía al diseño descartado y no es una dependencia de la agenda.
- Cada profesional y el administrador inician sesión mediante Google OAuth con sus propios correos personales autorizados. Todos tienen acceso operativo a ambas agendas propias de la aplicación.
- `felipe@gmail.com` y `eduardo@gmail.com` fueron ejemplos ilustrativos del usuario, no correos autorizados reales. No incorporarlos a una allowlist de producción; falta confirmar las direcciones personales reales.
- Google se usa solo para identidad (`openid email profile`): no pedir scopes Calendar, refresh token clínico, service account, delegación de dominio ni MCP de Google para administrar citas.
- Se eliminan correos, invitaciones automáticas y sincronización con calendarios externos. «Añadir a mi calendario» crea una copia manual independiente: cambios/cancelaciones de nuestra agenda no actualizan esa copia. La UI debe advertirlo.
- Volumen estimado por el usuario: unas diez atenciones semanales. Priorizar una solución pequeña; no añadir colas, sincronización externa o servicios de correo del diseño anterior.
- No construir un sistema complejo de backups como requisito del MVP. Revisar recuperación nativa D1 y documentar un procedimiento mínimo; la estabilidad del proveedor no evita borrados accidentales. Toda restauración remota requiere aprobación específica.
- Los cupos se ofrecen cada 60 minutos y cada reserva ocupa un bloque completo de 60 minutos, aunque la atención termine antes. No derivar el bloqueo de las duraciones de presentación del catálogo.
- La anticipación mínima es el día calendario siguiente, no 24 horas transcurridas. Ejemplo confirmado: si hoy son las 12:00, mañana a las 09:00 puede reservarse, siempre que sea una hora de atención disponible.
- Las 09:00 del ejemplo no fijan por sí solas las jornadas completas de ambos profesionales: falta confirmar días de atención, hora de cierre y pausas.

## Ventana de reserva

- No permitir reservas para hoy: la primera fecha elegible es mañana según el día local de Chile, independientemente de la hora actual.
- Mostrar como máximo una semana hacia adelante.
- La anticipación por día calendario está confirmada. Falta precisar los extremos inclusivos/exclusivos del máximo de una semana.
- Usar `America/Santiago` para las reglas de negocio y la presentación de fechas. Los límites y la disponibilidad definitiva los valida el servidor, no solamente el navegador.

## Módulo compartido de administración y profesionales

- Utiliza el mismo acceso con Google.
- El servidor reconoce al administrador y a los profesionales mediante una lista de correos autorizados; el navegador nunca decide el rol. Todos los miembros autorizados pueden gestionar ambos calendarios.
- Al ingresar, se muestra un panel con dos pestañas superiores: Felipe Méndez y Eduardo Lagos. Seleccionar una pestaña muestra la agenda correspondiente con horas ocupadas y disponibles.
- Puede registrar manualmente atenciones recibidas por WhatsApp u otros medios y bloquear ese horario.
- Tanto los profesionales como el administrador pueden consultar, crear, editar y eliminar/cancelar horas de cualquiera de las dos agendas. No se restringen a la agenda del profesional que inició sesión.
- Al guardar, se actualizan reserva y ocupación en D1 de forma atómica; sin llamadas a Google Calendar ni correos.
- La autorización del servidor se limita a las dos agendas lógicas configuradas de la clínica. Los pacientes y cuentas no autorizadas no tienen acceso a este panel ni a sus endpoints.
- Registrar cada cambio con el identificador del usuario actuante, reserva afectada, acción y fecha, sin copiar datos personales a logs. Pedir confirmación antes de eliminar una hora.
- Editar o cancelar actualiza reserva y ocupación en la misma transacción; cambiar de horario exige verificar el nuevo intervalo. Falta acordar tratamiento del historial. La copia personal externa no se sincroniza.

## Invariantes técnicos y de seguridad

- Google OAuth se usa solo para identidad; secretos de login y sesiones permanecen en servidor.
- Consultar disponibilidad no reserva un cupo. Desde el MVP, todas las confirmaciones, ediciones y bloqueos manuales necesitan idempotencia y exclusión atómica de intervalos por profesional.
- Reserva y ocupación comparten transacción D1. Un timeout HTTP no prueba que el commit falló: reintentar con la misma clave y consultar resultado sin duplicar. Ya no existe transacción distribuida con Calendar.
- No registrar RUT, tokens, datos personales ni contenido sensible en logs analíticos o mensajes de error públicos.
- No persistir información sensible del paciente en `localStorage`.
- Validar en servidor identidad, rol, profesional, fecha, duración, disponibilidad e idempotencia.
- Mantener funcionando el canal manual por WhatsApp durante la migración.

## Datos y decisiones pendientes

Registro canónico: [decisiones.md](decisiones.md) (D01–D09), con propuestas no aprobadas y fases bloqueadas. Specs vigentes: [índice](README.md); orden de ejecución futura: [plan maestro](planes/implementacion.md). Las versiones de `historico/` no son ejecutables.

Antes de habilitar reservas reales se deben confirmar:

1. Días, horarios, almuerzos y excepciones de cada profesional; confirmar alineación de los bloques horarios. Duración y separación de cupos ya definidas en 60 minutos.
2. Extremo inclusivo/exclusivo de la ventana máxima de una semana; la anticipación mínima por día calendario ya está definida.
3. Correos personales reales autorizados del equipo.
4. Ventana del equipo: permitir o no hoy, rangos mayores a una semana y reglas de bloqueos.
5. Proyecto y cliente OAuth de identidad, callbacks locales y de pruebas; sin Calendar.
6. Detalle de edición, cancelación/eliminación y desbloqueo por el equipo e historial. Estas acciones están solicitadas; cancelación/reprogramación autónoma del paciente y eliminación definitiva de datos personales siguen fuera del alcance salvo acuerdo.
7. Texto de consentimiento y política de privacidad para nombre, correo y RUT, incluyendo retención y acceso a los datos.
8. Persistencia del perfil recordado y política para personas sin RUT. El correo editable no acredita identidad ni recibe notificaciones.
9. Estrategia de secretos y eventual URL protegida de pruebas. Producción/DNS y recursos adicionales requieren nueva autorización.

## Entregables por fases

1. **Diseño y contratos:** reglas de agenda, modelo de datos, endpoints, amenazas y criterios de aceptación.
2. **MVP paciente:** identidad, datos, selección de profesional, disponibilidad, resumen, reserva atómica e idempotente, confirmación visible y enlace de copia al calendario personal.
3. **MVP del equipo:** acceso autorizado, dos pestañas de agenda compartida, registro/bloqueo manual, edición y cancelación/eliminación de horas en ambas agendas con la misma protección de intervalos del flujo paciente y auditoría del usuario actuante.
4. **Piloto y endurecimiento:** auditoría sin datos sensibles, accesibilidad y pruebas locales/E2E. Cualquier migración o despliegue remoto exige aprobación específica y destino dentro de la allowlist. Publicación de producción es una fase no autorizada todavía.

La cancelación/reprogramación autónoma por pacientes, pagos, historia clínica y recordatorios automáticos no deben añadirse sin una solicitud explícita. El equipo autorizado sí puede editar y cancelar/eliminar horas desde el panel compartido.
