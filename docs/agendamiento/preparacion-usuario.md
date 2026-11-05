# Preparación del usuario — sin secretos en chat

Guía para la ejecución posterior. No modifica cuentas ni infraestructura. Consultar [decisiones](decisiones.md), [tareas](tareas.md), [plan maestro](planes/implementacion.md) y [frontera Cloudflare](seguridad-cloudflare.md).

## 1. Lo primero: reglas de atención

Puedes responder con este formato:

```text
Felipe: días ..., desde ... hasta ..., pausa ...
Eduardo: días ..., desde ... hasta ..., pausa ...
Máximo paciente: confirmar o ajustar D+1 a D+7 inclusive
Equipo: puede/no puede registrar hoy; máximo hacia adelante ...
Bloqueos: duración ..., alineación ...
Administrador: correo real ...
Felipe: correo personal real ...
Eduardo: correo personal real ...
RUT: obligatorio/excepciones ...
Perfil para futuras reservas: último paciente guardado u otra política ...
Cambios/cancelación: campos permitidos ..., conservar historial ...
```

No hace falta volver a decidir que las atenciones ocupan una hora o que mañana no significa esperar 24h: ya está confirmado. Los emails públicos del sitio no son automáticamente autorizaciones de login.

Privacidad/retención y derechos sobre datos deben quedar aprobados antes de personas reales; no son equivalentes a decidir si se hacen backups. El proyecto no implementa historia clínica.

## 2. Google: únicamente acceso con Google

No se necesita cuenta padre para calendarios ni habilitar Google Calendar API. Tampoco MCP de Google para que funcione la agenda.

Cuando el spike local P07 haya fijado origen/puerto/callback y se autorice preparar la integración:

1. Acceder a Google Cloud Console con la cuenta que administrará el proyecto OAuth. Crear/seleccionar **un proyecto exclusivo para Vida Sana**, sin modificar proyectos Google ajenos.
2. Configurar Google Auth Platform: nombre de app, correo de soporte/contacto y audiencia External para usuarios Gmail. Si está en Testing, añadir cuentas de prueba requeridas según la configuración Google vigente.
3. Crear cliente tipo Web application, solo para identidad; scopes `openid email profile`. No Calendar, Gmail, cloud-platform, offline ni service account.
4. Registrar redirects exactos acordados de `/auth/google/callback`: localhost para prueba local y host HTTPS de staging solo cuando esté aprobado. No usar comodines ni URLs de preview efímeras. No inventar el dominio/puerto antes de P07/D09.
5. Guardar client ID y secret por configuración local segura/Workers Secrets cuando se autorice; **no pegarlos en chat ni Git**. Client ID no es contraseña, pero también debe seguir la configuración por entorno.
6. Completar tú mismo el login/consentimiento en navegador con cuentas de prueba. Un agente no necesita tu contraseña ni códigos de recuperación.

El agente puede preparar instrucciones/código/configuración local. Crear recursos Google, registrar dominios o guardar secretos requiere autorización concreta y herramientas disponibles; el MCP Cloudflare no administra Google Cloud. No se promete automatizar el consentimiento ni evitar trámites de publicación/verificación que Google exija.

## 3. Cloudflare: lo existente y lo pendiente

Worker y D1 de staging ya existen; ver [inventario](cloudflare-staging.md). **No necesitas crear otra base ni conectar el dominio ahora.** El MCP está conectado, pero no limitado técnicamente por recurso de manera certificada.

Antes del piloto tendrás que:

- Aprobar diff, SQL, names de secretos y destino exacto del lote; no un permiso abierto sobre la cuenta.
- Aprobar o rechazar una URL de pruebas y su protección. Las URLs actuales siguen apagadas; no cambiamos DNS de tu sitio.
- Probar que tú y ambos profesionales pueden operar ambas agendas y que un paciente no puede entrar al panel.
- Decidir si deseas aislamiento administrativo adicional con una cuenta/credencial separada. Los documentos no crean ese aislamiento por sí solos.

Producción, DNS, permisos, restauraciones y nuevos recursos requieren decisiones posteriores separadas. No hay pagos ni correo transaccional que contratar para este MVP.
