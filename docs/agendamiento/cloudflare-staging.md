# Recursos exclusivos de pruebas — Vida Sana

Fecha de provisión: 2026-11-05. Creación autorizada por el usuario. No se migró el sitio ni se habilitó una aplicación de reservas.

Antes de cualquier operación leer [seguridad-cloudflare.md](seguridad-cloudflare.md). La aprobación inicial de creación ya terminó: este inventario no autoriza despliegues, migraciones, borrados, restauraciones ni exposición pública futuros. El plan vigente está en [planes/implementacion.md](planes/implementacion.md).

## Inventario autorizado

| Recurso | Nombre / ID |
|---|---|
| Cuenta seleccionada | `21c858ed53ec9083b6fcd89d18c27372` |
| Worker nuevo | `vida-sana-reservas-staging` |
| Base D1 nueva | `vida-sana-reservas-staging` |
| UUID de D1 | `3d91d453-2ef5-4601-80cf-27622a0787bf` |
| Binding del Worker | `DB`, exclusivamente al UUID anterior |
| Etiquetas del Worker | `vida-sana`, `staging` |

Los identificadores no son credenciales. La cuenta y los recursos se especifican explícitamente para evitar selecciones por defecto.

## Estado verificado mediante MCP

- Los nombres no existían en las consultas previas; se crearon sin sobrescribir un Worker o base existente.
- D1 vacía: cero tablas; no se ejecutaron migraciones ni consultas sobre datos de pacientes.
- Worker con módulo bootstrap mínimo, sin assets, OAuth, secretos, acceso a calendarios, correos ni lógica de reservas. El handler devuelve `503 not_configured` y no consulta la base.
- Binding `DB` verificado mediante lectura de configuración del Worker.
- `workers.dev` deshabilitado y URLs de preview deshabilitadas, comprobados después de la creación.
- No se crearon rutas, dominios personalizados ni registros DNS. No se modificó `centrovidasana.cl` ni recursos de otros proyectos.
- La API de D1 denomina la versión de su motor `production`; ese valor no significa que esta base tenga datos o uso productivo. Este recurso pertenece solo al entorno de pruebas por su inventario y configuración.

El upload API crea un despliegue del bootstrap del Worker nuevo, no un despliegue del sitio actual ni de la futura aplicación.

## Configuración local

- `infra/cloudflare-staging/worker.js`: fuente del bootstrap subido.
- `infra/cloudflare-staging/wrangler.jsonc`: cuenta, nombre y binding exclusivos de staging. Mantiene deshabilitadas las URLs públicas.
- No se instaló Wrangler. La configuración se preparó para su uso posterior, sujeto a validación de versión y aprobación de despliegue.
- No usar esta configuración como producción ni apuntarla a una base de otro proyecto.

## Frontera de seguridad

Worker y base separados aíslan los datos y el runtime: este Worker solo tiene el binding D1 indicado, sin bindings de servicios de otros proyectos.

**Esto no restringe automáticamente la autorización administrativa del MCP.** No se modificaron tokens, IAM ni la autorización OAuth de Cloudflare. Su alcance depende de los permisos concedidos al conectarlo; no se ha certificado un aislamiento por recurso de esa credencial.

Regla operativa: toda escritura posterior queda limitada a los dos recursos de este inventario y requiere aprobación según la tarea. No realizar operaciones globales, DNS, cambios de plan ni consultas de datos de otros proyectos. Para aislamiento administrativo estricto, usar una cuenta Cloudflare independiente o evaluar una credencial realmente restringida por recurso, si los productos/permisos lo permiten. No afirmar que un token de Workers/D1 queda limitado por nombre sin comprobar sus capacidades.

## Próximos pasos, no realizados

1. Ratificar las especificaciones y planes vigentes ya redactados: D1 como agenda oficial, Google solo login, sin correo/API Calendar; enlaces de copia personal.
2. Resolver el registro de decisiones y autorizar la implementación local según el plan maestro. La lista de tareas ya está redactada; no implica ejecución.
3. Implementar y probar localmente; después aprobar migraciones exclusivamente en esta D1 de staging.
4. Aprobar por separado una URL de pruebas protegida y el despliegue de la aplicación.
5. Producción, dominio y DNS requieren otra autorización explícita y recursos propios.
