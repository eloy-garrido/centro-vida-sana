# Registro de decisiones del agendamiento

Estado: Fase 0 cerrada por el usuario el 2026-11-05 para D01–D07. D08 y D09 quedan asociadas a las fases de integración y staging respectivamente.

| ID | Decisión | Definición acordada | Estado / Fecha | Documentos afectados |
|---|---|---|---|---|
| D01 | Jornadas por profesional (Felipe y Eduardo) | Lunes a Viernes 09:00 a 21:00 (colación 13:00 a 14:00, 11 turnos de 60 min). Sábados 09:00 a 14:00 (5 turnos de 60 min). Domingos cerrado. Bloques fijos de 60 min alineados a la hora. | **Cerrada** (2026-11-05) | S03, S04, S05, P03 |
| D02 | Extremo semanal del paciente | Rango permitido para pacientes: desde mañana (D+1) hasta 7 días hacia adelante (D+7) inclusive (`[inicio D+1, inicio D+8)` en hora de Chile `America/Santiago`). | **Cerrada** (2026-11-05) | S03, S04, P03, P04 |
| D03 | Correos autorizados del equipo (Google OIDC) | Correo inicial del equipo / administración: `centrovida.sanaaustral@gmail.com`. Acceso total a ambas agendas (`felipe` y `eduardo`). Correos individuales de Felipe y Eduardo se integrarán cuando el usuario los suministre. | **Cerrada** (2026-11-05) | S01, S05, P01 |
| D04 | Ventana de operaciones del equipo y bloqueos | El equipo puede agendar citas en el mismo día (D+0) y dentro del mes corriente (hasta fin de mes / ~4 semanas). Bloqueos de agenda de 60 min alineados a la hora. | **Cerrada** (2026-11-05) | S03, S05, P03, P05 |
| D05 | Paciente: RUT, excepciones y perfil recordado | RUT chileno obligatorio por defecto (validación módulo 11), permitiendo opción de pasaporte / extranjero. Autocompletar datos en la 2da reserva vinculados a la cuenta Google. Trazabilidad: registrar `created_at` (cuándo agendó) y fecha/hora programada de atención. | **Cerrada** (2026-11-05) | S02, S04, P02, P04 |
| D06 | Retención, privacidad e historial | Cancelación lógica (`status = 'cancelada'`), sin borrado físico ni hard-delete de datos de auditoría. Trazabilidad de citas y preservación de registros. | **Cerrada** (2026-11-05) | S02, S03, P02, P03 |
| D07 | Ediciones, cancelaciones y traslado de agenda | Cancelación soft-delete sin hard-delete. Traslado entre profesionales no permitido directamente en MVP (debe cancelarse y crearse en la otra agenda). | **Cerrada** (2026-11-05) | S03, S05, P03, P05 |
| D08 | Proyecto/cliente Google OAuth | OIDC `openid email profile`. Mocks locales en desarrollo; credenciales reales exclusivas de Vida Sana requeridas para pruebas finales antes de staging. Sesión absoluta de 8 horas. | Pendiente para pruebas reales | S01, P01 |
| D09 | Staging remoto: URL, secretos, migración y deploy | Mantener URLs apagadas. Aprobación expresa de lote antes de mutar recursos de Cloudflare staging. | Pendiente de Fase 2 (E7) | S07, P07 |

---
**Nota:** El cierre de D01–D07 habilita la ejecución inmediata de la **Fase 1 (Entregas locales E1 a E6)** sin supuestos ambiguos. No se realizan mutaciones remotas en Cloudflare sin aprobación previa.
