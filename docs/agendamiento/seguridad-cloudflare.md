# Frontera obligatoria de Cloudflare para todos los agentes

Estado: política operativa vigente. Aplica a MCP, CLI/Wrangler, SDK, HTTP directo, CI y subagentes. No constituye una restricción IAM de la cuenta.

## Allowlist exacta de recursos

| Campo | Único valor autorizado para pruebas |
|---|---|
| Cuenta Cloudflare | `21c858ed53ec9083b6fcd89d18c27372` |
| Worker | `vida-sana-reservas-staging` |
| Nombre D1 | `vida-sana-reservas-staging` |
| UUID D1 | `3d91d453-2ef5-4601-80cf-27622a0787bf` |
| Binding | `DB` → ese UUID D1 |
| Configuración local | `infra/cloudflare-staging/wrangler.jsonc` |

Los IDs del inventario prevalecen sobre nombres parecidos y valores por defecto del MCP. Que la credencial permita una operación no significa que el usuario la haya autorizado.

## Antes de cualquier acceso remoto

1. Leer este documento, `contexto.md` e inventario `cloudflare-staging.md`.
2. Identificar propósito, entorno, método, cuenta y recurso exactos. Usar `account_id` explícito en MCP y cuenta/configuración explícitas en CLI; nunca seleccionar por cuenta activa implícita.
3. Comprobar coincidencia exacta de cuenta + nombre Worker o UUID D1. Para cambios de bindings, verificar también todos sus destinos.
4. Consultar únicamente el recurso exacto, mediante su ID o un filtro del servidor en la petición. No explorar bases, Workers, logs, secretos, DNS o datos de otros proyectos. Si una API solo permite listar globalmente, detenerse y pedir aprobación específica antes de usarla. Filtrar la respuesta después de listar no limita el acceso ni sustituye esa aprobación.
5. Para mutaciones, presentar previamente qué se cambiará y obtener aprobación explícita de esa operación o lote acotado. La aprobación de creación inicial ya se consumió: no autoriza futuras migraciones, deploys ni eliminaciones.
6. Si falta un ID, hay discrepancia, el recurso no existe o aparece otro binding: **detenerse y preguntar**. No crear reemplazos, corregir recursos ajenos ni cambiar de cuenta automáticamente.
7. Después de una mutación aprobada, verificar mediante lectura y registrar resultado, solo de los recursos autorizados; no guardar secretos ni datos personales.

## Prohibiciones sin nueva autorización específica

- Cambiar DNS, nameservers, MX, dominios personalizados, rutas de zona o configuración de `centrovidasana.cl`.
- Crear/modificar/eliminar recursos fuera de la allowlist o actuar sobre otra cuenta.
- Cambiar tokens, OAuth del MCP, IAM, miembros, facturación, plan o configuración global de Cloudflare.
- Conectar este Worker a bases, servicios, buckets, colas o secretos de otros proyectos.
- Activar `workers.dev`, URLs de preview o cualquier acceso público. Ambos están actualmente deshabilitados.
- Ejecutar `DROP`, borrados masivos, restauraciones, reset/recreación de D1 o eliminación del Worker/base, incluso si están en la allowlist.
- Crear producción, CI con despliegue automático o migraciones remotas por deducción de una solicitud de trabajo local.

No usar comodines, iteraciones sobre todos los recursos ni comandos globales. Nunca reutilizar recursos encontrados para ahorrar cuota/coste.

## Delegación

- El coordinador entrega esta allowlist completa y el límite de autorización en cada delegación que involucre Cloudflare.
- Frontend y QA trabajan localmente por defecto; no necesitan acceso administrativo remoto. El revisor es read-only y no ejecuta mutaciones.
- Backend puede preparar código/migraciones locales. Las acciones remotas corresponden al coordinador o un ejecutor expresamente delegado, con aprobación y destino exactos.
- Ningún agente puede ampliar esta política, alterar el inventario o los archivos de permisos para autorizarse a sí mismo. Solo se actualiza la frontera por instrucción explícita del usuario.

## Alcance real de la protección

La separación de Worker/D1 protege el runtime y evita mezclar datos. La autorización administrativa del MCP **no ha sido certificada como limitada a estos recursos**. Prompts y documentación reducen errores, pero no ofrecen una garantía técnica de riesgo cero.

Para aislamiento administrativo fuerte, evaluar una cuenta separada o credenciales cuya restricción efectiva por recurso se haya comprobado. No se crearán/cambiarán cuentas o credenciales como parte de esta política sin aprobación.
