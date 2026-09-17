# WOD Translator — MVP reducido para portfolio

**Autor:** Diego Gonzalo Sánchez  
**Fecha:** 16 de septiembre de 2026  
**Estado:** alcance propuesto para implementación  
**Objetivo de esfuerzo:** 16–24 horas efectivas, sujeto a las condiciones de la planificación.

## 1. Objetivo del proyecto

Crear una aplicación pequeña y terminada que convierta un entrenamiento de CrossFit escrito en texto libre en una ficha clara, editable y adaptable al material disponible.

Complementa la ticketera en el portfolio: mientras aquella muestra una aplicación con persistencia, autenticación y transacciones, WOD Translator permite demostrar integración de IA, validación de datos y diseño de una experiencia frontend cuidada.

Este documento es independiente del análisis amplio anterior y define el alcance que se debe implementar para esta versión. No se deben incorporar automáticamente funcionalidades del documento anterior.

**Flujo único:** pegar WOD → interpretar → revisar y editar → adaptar opcionalmente → copiar o guardar en el navegador.

## 2. Alcance cerrado

### Incluido

- Una pantalla responsive con el flujo completo.
- Entrada de un WOD por texto, en español o inglés; interfaz y explicaciones en español.
- Interpretación mediante IA y presentación en una ficha estructurada.
- Explicación breve de abreviaturas reconocidas.
- Corrección manual de los datos interpretados.
- Propuesta de sustituciones según el material disponible.
- Revisión y aceptación explícita de cada sustitución.
- Copia del resultado como texto legible.
- Guardado y recuperación del último entrenamiento en el navegador.
- Tres ejemplos precargados con resultados de muestra, sin consumo de IA.
- API mínima para llamar al modelo, validar respuestas y limitar consumo.
- Pruebas esenciales, despliegue y README.

### Excluido

- Registro, login, JWT, perfiles y recuperación de contraseñas.
- Base de datos, Drizzle, migraciones e historial en servidor.
- Listado de entrenamientos guardados: solo se conserva el último en el navegador.
- Resultados deportivos, récords, estadísticas, rankings y calendario.
- Programación de entrenamiento y recomendaciones sobre lesiones.
- OCR, imágenes, audio, vídeo o integraciones con plataformas deportivas.
- Chat libre, agentes, RAG, búsqueda web y base de datos vectorial.
- Pagos, suscripciones y funciones sociales.
- Librería visual independiente, microservicios y aplicación móvil nativa.

## 3. Formatos soportados

Limitar el MVP a un único bloque de **AMRAP** o **For Time**, con cantidades constantes por movimiento. For Time puede incluir rondas fijas y un time cap explícito.

EMOM, intervalos complejos, múltiples bloques, escaleras de repeticiones y porcentajes de 1RM quedan fuera de esta versión. Ante esos casos, mostrar que el formato no está soportado y conservar el texto para su edición. Nunca reinterpretarlos silenciosamente como otro formato.

Ejemplo:

> AMRAP 15': 10 thrusters 40/30 kg, 12 TTB, 200 m run.

La ficha debe conservar los tres movimientos, la duración y las cantidades. Las cargas `40/30 kg` son dos opciones; no se elige una ni se asignan etiquetas que no aparezcan en el original. Si falta una unidad o el significado de una abreviatura es dudoso, se pide revisión.

## 4. Requisitos y criterios de aceptación

| ID | Requisito | Criterio de aceptación |
|---|---|---|
| RF-01 | Introducir texto | Se rechaza entrada vacía o superior a 2.000 caracteres. El texto no se pierde al fallar la petición. |
| RF-02 | Interpretar el WOD | Se extraen formato, duración, rondas, movimientos y cantidades presentes. Los datos desconocidos permanecen vacíos. |
| RF-03 | Explicar abreviaturas | Las definiciones se muestran separadas del texto original. Las abreviaturas desconocidas se señalan sin inventar su significado. |
| RF-04 | Editar | Se pueden corregir formato, tiempos, rondas, nombres, cantidades y cargas. Las entradas inválidas muestran errores junto al campo. |
| RF-05 | Elegir material | Un selector permite indicar material disponible y pesos opcionales. La ausencia de información no implica disponibilidad. |
| RF-06 | Adaptar | La IA propone sustituciones con motivo y material necesario, vinculadas a los movimientos originales. |
| RF-07 | Aceptar cambios | Cada sustitución se acepta o rechaza. La propuesta nunca sobrescribe automáticamente el original. |
| RF-08 | Copiar | Se copia un resumen de la ficha revisada o de la variante aceptada. Si falla el portapapeles, se permite selección manual. |
| RF-09 | Guardar localmente | Un botón guarda el último WOD, sus correcciones y la variante aceptada. Puede recuperarse después de recargar y borrarse. |
| RF-10 | Probar ejemplos | Tres ejemplos permiten explorar el resultado sin registro ni llamadas al proveedor. Se identifican como demostraciones. |
| RF-11 | Resolver errores | Hay estados claros para formato no soportado, respuesta inválida, límite de uso, fallo de red y timeout. |

Guardar y copiar nunca llaman a la IA. La adaptación solo está disponible cuando el usuario ha revisado los datos relevantes y resuelto las dudas que impiden interpretarlos.

## 5. Experiencia e interfaz

Una sola ruta y tres zonas dentro de la misma pantalla:

1. **Entrada:** textarea, ejemplos y botón “Interpretar”.
2. **Revisión:** ficha editable, abreviaturas y dudas pendientes; acceso al original.
3. **Adaptación y salida:** selector de material, propuestas, aceptación, copia y guardado local.

En escritorio, usar dos columnas para comparar original y ficha. En móvil, apilar los bloques. La prioridad es que se entienda el resultado con pocos pasos.

Estados: inicial, interpretando, revisión necesaria, listo, adaptando y error. Anunciar carga y errores de manera accesible. Evitar enviar otra petición mientras una está en curso.

Si el usuario modifica el texto original, marcar la ficha existente como desactualizada y solicitar reinterpretación. Si modifica la ficha después de pedir una adaptación, invalidar la propuesta anterior. No sobrescribir correcciones con respuestas tardías de una petición previa.

## 6. Stack y arquitectura mínima

| Capa | Elección | Motivo |
|---|---|---|
| Frontend | React + Vite + TypeScript | Continuidad con la ticketera y buena base para una interfaz interactiva. |
| Estilos | CSS Modules y variables CSS | Suficiente para una única pantalla y unos pocos componentes. |
| Estado | Estado local de React | No hay historial remoto ni un flujo que necesite un gestor global. |
| Backend | Node.js + Fastify + TypeScript | Mantener la clave privada, validar y limitar llamadas. |
| Contratos | Zod y tipos compartidos | Validación en ejecución de entrada y salida, además del tipado. |
| IA | Un proveedor y su SDK oficial | Dos operaciones concretas, sin framework de agentes. |
| Persistencia | localStorage | Conservar únicamente el último entrenamiento en el mismo navegador. |
| Pruebas | Vitest, React Testing Library y Playwright | Reglas esenciales, interacción y un recorrido completo. |

No hace falta React Router con una única pantalla. Tampoco Drizzle, PostgreSQL, JWT, Redux o TanStack Query para este alcance. Se mantiene el núcleo tecnológico de la ticketera y se omiten capas que no tienen una función en el MVP.

Fijar versiones compatibles al comenzar; no copiar automáticamente las versiones antiguas del otro proyecto.

Organización propuesta:

| Ubicación | Contenido |
|---|---|
| `packages/web` | Pantalla, componentes, estado, cliente HTTP y almacenamiento local. |
| `packages/api` | Rutas, validación, controles de consumo y adaptador de IA. |
| `packages/shared` | Esquemas y tipos del WOD, peticiones y respuestas. |

El backend aplica las reglas y llama al proveedor. El modelo no ejecuta código, no navega, no accede a almacenamiento y no decide límites de uso.

## 7. Contrato de datos

El WOD estructurado contiene:

- `schemaVersion`: versión del contrato.
- `format`: `amrap` o `for_time`.
- `durationSeconds`: duración de AMRAP, si aparece.
- `rounds`: rondas de For Time, si aparecen.
- `timeCapSeconds`: límite de For Time, si aparece.
- `movements`: lista ordenada con identificador, nombre, cantidad, unidad, opciones de carga y fragmento del texto original.
- `explanations`: abreviaturas y definiciones.
- `issues`: campos dudosos o ausentes que requieren revisión.

Usar `null` para datos desconocidos. Validar valores positivos, longitudes máximas y un máximo de 10 movimientos. Las unidades admitidas se fijan en el esquema. Mantener las cargas alternativas como lista, sin seleccionar una por defecto.

La adaptación devuelve una lista de propuestas: identificador del movimiento original, sustitución, material necesario, motivo y limitaciones. La aceptación de cada propuesta se gestiona en el frontend.

El almacenamiento local conserva texto original, ficha revisada, propuestas aceptadas, fecha y versión del esquema. Al leerlo, validar la estructura; si está corrupto o usa una versión no compatible, ofrecer reiniciarlo. Gestionar errores de cuota o acceso a localStorage sin bloquear el resto de la aplicación.

El guardado no sincroniza entre dispositivos y puede perderse si se borran los datos del navegador. Indicarlo junto a “Guardar en este navegador”.

## 8. API

| Ruta | Entrada | Salida |
|---|---|---|
| `POST /api/parse` | Texto del WOD | Ficha estructurada, explicaciones, dudas e identificador de petición. |
| `POST /api/adapt` | Ficha revisada y material disponible | Propuestas de sustitución, sin aplicarlas. |
| `GET /api/health` | Sin datos | Estado básico del servicio; sin llamada al modelo. |

Errores homogéneos con `code`, `message` y `requestId`. Distinguir 400 para entrada inválida, 422 para formato no soportado, 429 para límites y 502/504 para errores del proveedor o timeout.

Validar también la ficha recibida por `/api/adapt`: no confiar en que proceda realmente de la pantalla de revisión.

## 9. Uso de IA y límites funcionales

### Interpretación

El modelo extrae datos y explica abreviaturas. No completa cantidades, unidades o cargas que no estén presentes. El texto se envía como contenido no confiable, separado de las instrucciones de la aplicación.

Después de recibir la respuesta, validar esquema e invariantes. Un JSON válido no garantiza exactitud: la ficha siempre permite revisión y comparación con el original. Si la respuesta no supera la validación, mostrar error y conservar la entrada.

### Adaptación

El modelo recibe la ficha revisada y el material declarado. Proponer solo alternativas compatibles. Si faltan pesos necesarios, pedir que se indiquen o dejar la carga por decidir; no atribuir una capacidad física al usuario.

Las equivalencias entre carrera, bici y remo son aproximadas y pueden cambiar el estímulo. No presentar una sustitución como idéntica ni como recomendación personalizada para una lesión.

Mantener un catálogo inicial pequeño de material y necesidades de movimientos frecuentes. Las alternativas desconocidas o no verificables se rechazan o quedan pendientes de revisión, sin aceptarse automáticamente.

### Implementación acotada

- Un único proveedor configurable desde el backend.
- Dos prompts versionados: interpretación y adaptación.
- Una respuesta estructurada completa por operación; sin streaming.
- Sin reintentos automáticos iniciales: un fallo conserva los datos y ofrece reintento manual.
- Timeout propuesto de 25 segundos y límite de salida configurable.
- Seleccionar el modelo tras probar los ejemplos de evaluación; no introducir comparación automática de proveedores en la aplicación.

## 10. Protección de la demo pública

Una API sin login necesita límites antes de habilitar llamadas reales:

- Clave del proveedor solo en el servidor, nunca en el bundle de Vite.
- Límite orientativo inicial de 5 peticiones por IP y hora y una llamada en curso por IP.
- Límite global de concurrencia y de operaciones, además de un presupuesto de consumo.
- Comprobar y reservar el cupo antes de llamar al proveedor; limitar tanto interpretación como adaptación.
- Configurar correctamente el proxy de confianza para no aceptar cualquier cabecera de IP del cliente.
- No considerar CORS una protección contra abuso: restringe navegadores, no clientes externos.
- Al agotarse el cupo, mantener disponibles los ejemplos precargados.

Para un despliegue de una sola instancia, los contadores en memoria son simples, pero se reinician y no coordinan varias instancias. No constituyen un límite de gasto duradero. Complementarlos con un límite duro del proveedor, si existe, o controles duraderos de la plataforma. Si el alojamiento elegido no permite asegurar el límite global, publicar en modo demo sin llamadas reales hasta resolverlo.

Registrar operación, latencia, resultado y uso de tokens cuando el proveedor lo facilite. Evitar guardar el texto completo en logs. Informar al usuario de que, al interpretar o adaptar, su texto se envía al proveedor de IA.

Servir frontend y API bajo el mismo origen mediante `/api` simplifica el despliegue. El proceso Node debe alojarse en una plataforma compatible; un alojamiento exclusivamente estático no ejecutará Fastify.

## 11. Pruebas y evaluación mínimas

Crear 10 casos revisados manualmente: 4 WOD válidos, 2 con datos ambiguos, 2 con formatos excluidos y 2 con texto inválido o instrucciones que intentan alterar el comportamiento del modelo.

Comprobar conservación de cantidades y unidades, identificación del formato, orden de movimientos y señalización de dudas. Para adaptación, añadir comprobaciones de material declarado y de conservación del original.

Pruebas automáticas prioritarias:

- Contratos: entradas inválidas, cantidades negativas y respuesta del modelo fuera del esquema.
- API: límite alcanzado, timeout y proveedor fallando.
- UI: correcciones manuales, aceptación de cambios y fallo de almacenamiento.
- Un E2E: ejemplo → ficha → edición → adaptación simulada → guardado → recarga → copia.

Usar un proveedor simulado en CI. Ejecutar aparte los 10 casos con el modelo real y documentar resultados y fallos; no presentar ese conjunto pequeño como prueba de precisión general.

## 12. Plan de ejecución

| Fase | Resultado | Horas orientativas |
|---|---|---:|
| 1 | Esqueleto, contratos y tres ejemplos de demostración | 2–3 |
| 2 | Interfaz completa con datos simulados y edición | 4–5 |
| 3 | Backend e interpretación real validada | 3–5 |
| 4 | Adaptación, copia y guardado del último WOD | 3–4 |
| 5 | Límites, pruebas esenciales, despliegue y README | 4–7 |
| **Total** | **MVP reducido** | **16–24** |

La estimación supone familiaridad con el stack, diseño sencillo, una plataforma conocida y ausencia de integraciones adicionales. El ajuste de prompts y los controles de alojamiento pueden aumentar el esfuerzo. A unas 8 horas semanales, reservar aproximadamente 2–3 semanas de trabajo, con margen si aparecen esos problemas.

Construir primero el flujo sin IA usando ejemplos y respuestas simuladas. Después conectar interpretación y, finalmente, adaptación. No desarrollar funcionalidades excluidas antes de completar y publicar este recorrido.

## 13. Definición de terminado

- El recorrido completo funciona en móvil y escritorio.
- Los datos originales se conservan y los cambios requieren aceptación.
- Las respuestas de IA se validan y los errores no hacen perder el texto.
- Copia y guardado local funcionan, incluidos sus estados de error.
- Los ejemplos públicos funcionan sin coste de IA y están claramente identificados.
- La clave permanece en backend y las llamadas públicas tienen controles de consumo efectivos.
- Pasan las pruebas esenciales y se han revisado casos reales del modelo.
- El repositorio incluye instrucciones reproducibles, `.env.example` sin secretos y lockfile.
- Hay una demo accesible, capturas y un README que explica decisiones y limitaciones.

## 14. Presentación en GitHub

El README debe incluir: problema resuelto, demo, capturas, stack, arquitectura breve, instalación, variables de entorno, pruebas, límites conocidos y decisiones principales.

Destacar qué aporta la IA y qué controla el código: extracción de texto y propuestas por parte del modelo; validación, estados, límites y aceptación por parte de la aplicación.

Demo sugerida de 90 segundos: pegar WOD → explicar una abreviatura → corregir un dato → sustituir un movimiento por falta de material → aceptar → copiar.

No afirmar que el proyecto tiene usuarios reales, una precisión determinada o ahorros medidos hasta disponer de evidencia. El objetivo del portfolio es mostrar una pieza pequeña, terminada y defendible técnicamente.
