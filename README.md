# IrukaData

IrukaData es una aplicación en desarrollo para gestionar equipos de vóleibol y registrar estadísticas de los jugadores del propio club durante los partidos. Está pensada para acompañar tanto el trabajo de organización de una temporada como el registro rápido desde la cancha.

El proyecto prioriza el funcionamiento local y sin conexión, una interfaz en español y controles adecuados para notebook y tablet. Su objetivo es reunir acciones técnicas, marcador, rotaciones, sustituciones oficiales y reemplazos de líbero en un mismo panel de partido.

**Estado actual:** la aplicación permite gestionar equipos, temporadas, deportistas, inscripciones, torneos y partidos. El panel en vivo guarda acciones, puntos y cambios sin conexión. El registro alimenta las estadísticas y el historial, y se puede conservar en un respaldo JSON local.

## Objetivos

- Organizar un club por equipos, categorías, temporadas y competiciones.
- Mantener un perfil único por deportista, con inscripciones y dorsales independientes por equipo y temporada.
- Agilizar el registro en vivo sin cambiar de pantalla para anotar acciones, puntos o cambios de jugadores.
- Aplicar reglas de puntuación, rotación y cambios mediante un motor independiente de la interfaz y del almacenamiento.
- Conservar el historial deportivo y ofrecer estadísticas por jugador, equipo, categoría, temporada y torneo.
- Trabajar con datos locales, sin requerir cuentas, nube ni un servidor de negocio.

El registro individual cubre a los jugadores del propio club. El rival se identifica por su nombre, marcador y equipo al servicio.

## Funcionalidades implementadas

- Pantalla de inicio y navegación en español.
- Configuración y edición del nombre de un único club.
- Creación, consulta y edición de equipos masculinos y femeninos en Sub 14, Sub 16, Sub 18, Sub 21 y TC, con búsqueda y filtros por rama, categoría y temporada.
- Creación y edición de temporadas con validación de fechas, y asociación de un equipo a varias temporadas.
- Archivado y restauración de equipos y temporadas conservando sus identidades y asociaciones.
- Creación, búsqueda, consulta y edición de perfiles de deportistas con nombre obligatorio, fecha de nacimiento y notas opcionales; archivado y restauración conservando el mismo ID.
- Búsqueda de deportistas con o sin tildes y aviso de posibles perfiles existentes. Se permiten homónimos sin fusionar personas automáticamente por nombre o fecha de nacimiento.
- Plantillas por equipo y temporada, con acceso desde Equipos y selección de deportistas existentes mediante tarjetas.
- Inscripción de una misma persona en varias categorías o temporadas sin duplicar su perfil, con dorsal y rol habitual independientes por inscripción.
- Dorsales enteros positivos y únicos entre las inscripciones activas de cada plantilla; no se impone todavía un rango reglamentario de torneo.
- Edición, archivado y restauración de inscripciones con ID estable. Archivar libera el dorsal; restaurar exige que esté disponible y que el perfil, equipo, temporada y asociación estén activos.
- Consulta desde la ficha de cada deportista de sus equipos, temporadas, dorsales, roles e inscripciones archivadas.
- Creación, edición, búsqueda, archivado y restauración de torneos por temporada, con tipo de competición y notas opcionales.
- Participación de varios equipos de la misma temporada en un torneo y de un equipo en varios torneos, con filtros y acceso desde la plantilla. Retirar y recuperar un equipo conserva el ID de su participación.
- Nombres de torneo únicos por temporada, incluidos los archivados. La temporada de un torneo existente se conserva para proteger sus referencias.
- Creación, consulta y edición de partidos en borrador asociados a una participación equipo–torneo, con rival, fecha y hora de la sede, lugar, condición local/visita/neutral y fase o jornada opcional.
- Lista de partidos con búsqueda por rival o jornada y filtros por torneo, temporada y plantilla; acceso desde cada torneo y ficha individual con reglas guardadas.
- Configuración independiente por partido del cupo de sustituciones, mínimo y máximo de líberos, umbral opcional para exigir dos y aviso de cambio de lado en el tercer set. Se conserva el formato acordado de mejor de tres a 25/25/15, con dos puntos de ventaja, como variante de torneo.
- Archivado y restauración de borradores con ID estable, sin cambiar su equipo o torneo al editarlos. Los datos y las reglas pueden corregirse mientras el partido siga en borrador. El primer guardado de la convocatoria cierra esa etapa. La selección de deportistas y la designación de líberos siguen editables hasta confirmar la alineación inicial.
- Convocatoria desde tarjetas de deportistas con perfil e inscripción activos en la plantilla del partido. Se guardan nombre, dorsal y designación de líbero para ese encuentro. La validación aplica los cupos del partido y exige seis deportistas sin designación de líbero.
- Alineación inicial del primer set con tarjetas de convocados, seis posiciones únicas, banca automática y líberos separados. La confirmación guarda el primer servicio y deja el set pendiente, listo para el saque. Se puede corregir antes de iniciar el set.
- Motor de partido independiente de React e IndexedDB. Aplica el catálogo de acciones y los puntos manuales, conserva o transfiere el servicio, rota al recuperar el saque propio y cierra sets y partidos al mejor de tres.
- Lotes de eventos que permiten reconstruir el estado del motor. Cada comando verifica la versión del partido y, al puntuar, la jugada vigente. IndexedDB guarda cada lote junto al cambio de fase y al estado del set en la misma transacción.
- Panel táctil con marcador, sets ganados, equipo al saque, posiciones propias en cancha, acciones y resultados, puntos manuales y últimos registros. Se accede con «Iniciar anotación» en la ficha de un partido listo para el saque.
- «Cambio oficial» y «Reemplazo de líbero» en la ficha del partido. Selecciona a quien sale en la cancha y elige entre los entrantes elegibles. Puedes agrupar varias parejas de cambio oficial en una sola solicitud. Entre solicitudes separadas del mismo tipo debe completarse una jugada.
- Cupo de cambios oficiales por set, pareja titular–suplente y reingreso a la casilla original de la alineación. Los reemplazos de líbero conservan a la persona regular vinculada y se registran fuera del cupo oficial. Si la rotación lleva a la líbero a la delantera, el panel pide registrar el retorno antes de continuar.
- Reanudación después de recargar o cerrar la ficha, incluso con una jugada abierta. «Deshacer» registra una corrección y restaura el estado previo, incluida la ocupación de cancha y el cupo de sustituciones. El inicio del primer set se conserva.
- Alineación y servicio independientes para cada set. Entre sets puedes armar una alineación nueva o editar una copia de la anterior. Si corresponde, el panel avisa el cambio de lado al llegar al umbral del tercer set.
- Historial de partidos de solo lectura con marcador por set, dorsales de la convocatoria, acciones, cambios y correcciones. Incluye filtros por deportista, equipo, categoría, temporada, torneo, partido y set.
- Estadísticas por deportista y equipo derivadas del historial efectivo, con los mismos filtros y descarga CSV. Los puntos manuales no se atribuyen a un deportista y los registros deshechos quedan fuera del cálculo. La participación se cuenta por partido y set a partir de la alineación y las entradas registradas.
- Respaldos JSON versionados. La vista previa compara los registros locales y los del archivo. La restauración valida las referencias y reconstruye el historial antes de sustituir los datos en una transacción.
- Demostración estática de solo lectura con nombres y equipos ficticios; sus datos no se insertan en la base del club.
- Estructura modular que separa dominio, estadísticas, aplicación, almacenamiento e interfaz.
- Contratos tipados para identidad, inscripciones, reglas por partido, eventos, cambios y proyecciones estadísticas, junto a un catálogo central de 22 resultados técnicos.
- Almacenamiento Dexie/IndexedDB para club, equipos, temporadas, sus asociaciones, deportistas, inscripciones, torneos, participaciones, partidos, convocatorias y alineaciones iniciales, con migraciones que conservan los datos anteriores, guardado transaccional y detección de ediciones desactualizadas entre pestañas.
- Manifiesto, iconos y caché PWA para cargar los recursos compilados sin conexión después de su preparación inicial, sin forzar la activación de nuevas versiones durante una sesión abierta.
- Configuración de TypeScript estricto, lint, pruebas unitarias, pruebas de componentes, pruebas de navegador e integración continua.

El dorsal pertenece a cada inscripción. La convocatoria conserva el dorsal y el nombre guardados para el partido aunque cambie el perfil o la inscripción.

Archivar un perfil, equipo o temporada conserva sus inscripciones. Una inscripción activa sigue reservando su dorsal hasta archivarla explícitamente. El rol habitual de líbero no constituye una designación de líbero para un partido.

Archivar un torneo conserva sus participaciones. Archivar un equipo o desvincular su temporada no retira automáticamente sus participaciones existentes; pueden conservarse o retirarse al editar el torneo. Añadir o recuperar una participación exige un equipo y asociación activos de la misma temporada. Con la temporada archivada, el torneo se puede consultar y archivar; para editarlo o restaurarlo hay que reactivar la temporada. El tipo de competición es descriptivo. Cada partido guarda su propio cupo y requisitos de designación. El panel aplica las reglas ordinarias de sustitución y reemplazo. Las excepciones arbitrales, como la sustitución excepcional por lesión y la redesignación de una líbero, quedan fuera del alcance actual.

Los partidos requieren una participación, torneo, equipo, asociación y temporada activos para crearse, editarse o restaurarse. Archivar o retirar una referencia conserva los partidos existentes y permite consultar y archivar sus borradores. La fecha y hora se guardan como hora local de la sede, tal como se ingresan, sin conversión automática de zona horaria. Se permiten varios encuentros con el mismo rival y horario; no se confunden por esos datos.

## Etapas de desarrollo

| Etapa | Objetivo | Estado |
| --- | --- | --- |
| Hito 0 — Especificación y cimientos | Estructura modular, contratos de dominio, catálogo de resultados, datos ficticios y herramientas de desarrollo y pruebas. | Implementado |
| Hito 1 — Club, equipos y perfiles | Gestión de equipos, categorías, temporadas, deportistas e inscripciones con dorsal independiente. Un mismo perfil puede pertenecer a varias plantillas. | Implementado |
| Hito 2 — Torneos, partidos y alineación | Competiciones, creación de partidos, convocatoria, seis titulares por posición y designación de líberos. | Implementado hasta la preparación del primer set |
| Hito 3 — Motor puro de partido | Estados de partido y jugada, puntuación, servicio, rotaciones y cierre de sets y partidos. | Motor implementado y probado como módulo |
| Hito 4 — Panel de anotación en vivo | Interfaz táctil para acciones y puntos, eventos recientes, deshacer, guardado automático y reanudación. | Implementado |
| Hito 5 — Cambios oficiales y reemplazos de líbero | Flujos de cambio dentro del panel, validación de elegibilidad y reingresos, límites configurables y seguimiento del vínculo líbero–jugador regular. | Implementado |
| Hito 6 — Estadísticas, historial y respaldo | Estadísticas derivadas de eventos, filtros, consulta del historial y exportación/importación de respaldos. | Implementado |
| Hito 7 — Calidad y lanzamiento del MVP | Validación del partido completo offline, controles táctiles, reapertura del navegador, respaldo restaurable y guía de uso. | Verificado para piloto local |

## Tecnologías

- **Interfaz:** React, TypeScript, Vite, React Router y CSS local.
- **Almacenamiento local:** IndexedDB mediante Dexie.
- **Recursos offline:** PWA mediante `vite-plugin-pwa`.
- **Calidad:** ESLint, Vitest, Testing Library y Playwright.

## Preparación y arranque

Requisitos: Node.js 22.13 o superior y pnpm 11.25.0 (recomendado Node 24 LTS). La primera instalación de dependencias requiere internet; ejecutar la aplicación no utiliza servicios externos.

Para obtener una copia del proyecto:

```powershell
git clone https://github.com/Camilo-hc/IrukaData.git irukadata
```

Desde la carpeta que contiene `irukadata`, ejecutar lo siguiente. Si ya tienes el proyecto local, utiliza esa copia sin volver a clonarlo.

```powershell
cd irukadata
pnpm install --frozen-lockfile
pnpm dev
```

Abrir la dirección que muestra Vite, normalmente `http://127.0.0.1:5173`. No abrir `index.html` directamente con `file://`.

Para comprobar la versión PWA:

```powershell
pnpm build
pnpm preview
```

Abrir `http://127.0.0.1:4173` con acceso a los recursos locales y esperar a que termine la preparación del service worker. Después puede recargarse sin conexión. El modo de desarrollo no instala service worker. La primera carga de un dispositivo nuevo requiere obtener los recursos locales. Vite solo sirve archivos durante desarrollo/previsualización; no existe servidor de negocio ni base de datos remota.

Mantén el mismo navegador, perfil y origen (protocolo, host y puerto). Cambiar `localhost` por `127.0.0.1` o usar otro puerto abre un almacenamiento distinto. Para usar la aplicación desde otro dispositivo, prepara un origen HTTPS de confianza accesible desde ese dispositivo. `127.0.0.1` siempre apunta al dispositivo desde el que abres el navegador. [Contextos seguros en MDN](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts)

Puedes usar el navegador directamente o instalar IrukaData como aplicación web. En Chrome de escritorio, abre el menú del navegador y busca **Instalar página como aplicación**. Hazlo desde el mismo perfil y origen que usarás para anotar. [Instalar aplicaciones web en Chrome](https://support.google.com/chrome/answer/9658361?hl=es)

## Guía rápida de cancha

1. **Antes del partido.** Abre la compilación en el navegador que llevarás a cancha. Una vez cargada, detén la previsualización o desconecta la red si usas un origen remoto y vuelve a abrir la misma dirección. Comprueba que se muestran los partidos y que el almacenamiento local está disponible. En **Respaldos** puedes solicitar almacenamiento persistente y guardar una copia JSON.
2. **Prepara la ficha.** Selecciona el equipo y la temporada en **Torneos**, crea el partido y confirma la convocatoria. Asigna las seis posiciones iniciales y el primer saque. Usa **Iniciar anotación** para abrir el panel.
3. **Registra en vivo.** Elige una persona en cancha, la acción y su resultado. Una acción terminal suma el punto correspondiente. Usa **Punto propio** o **Punto rival** cuando corresponda anotar el resultado manualmente. Entre jugadas puedes registrar un cambio oficial o un reemplazo de líbero junto a las acciones.
4. **Continúa y corrige.** Después de cada set, confirma seis titulares y el saque del siguiente. **Deshacer** corrige la última operación completa. Si se cierra el navegador, vuelve a la ficha en el mismo perfil para retomar el marcador, la cancha y la jugada abierta.
5. **Cierra y respalda.** Al terminar revisa el resultado en **Historial** y exporta el JSON desde **Respaldos**. Para probar la recuperación en otro perfil, abre la aplicación allí, selecciona el JSON y revisa la vista previa. La restauración reemplaza los datos locales de ese perfil.

Para el primer ensayo usa datos ficticios en un perfil separado. Prueba un 2–1 con sets de 25–23, 23–25 y 16–14, interrumpe el segundo set con una jugada abierta y verifica que el respaldo recupera los tres marcadores.

## Verificaciones

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

`pnpm check` ejecuta tipos, lint, unitarias, build y E2E. Los E2E usan la compilación y levantan/cierran su propia previsualización en el puerto 4173; ese puerto debe estar libre. Si Chromium no está descargado pero Chrome está instalado:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'chrome'
pnpm test:e2e
```

La descarga inicial del navegador de pruebas requiere internet. El build no descarga recursos de red.

Para repetir solo el partido de aceptación del MVP:

```powershell
pnpm build
pnpm test:e2e tests/e2e/mvp-match.spec.ts
```

## Alcance actual del modo offline

La caché offline disponible cubre los recursos de la aplicación. Después de su preparación inicial, la gestión de equipos, temporadas, deportistas, inscripciones, torneos, partidos, convocatorias y alineaciones iniciales permite guardar datos y volver a consultarlos sin conexión. La demostración continúa separada de los datos reales del club. Los partidos, sus reglas, sus convocatorias, el marcador y la jugada abierta se recuperan al recargar o reabrir la aplicación.

IndexedDB pertenece al navegador y al dispositivo. Desde **Respaldos** puedes descargar una copia JSON y solicitar almacenamiento persistente si el navegador lo permite. Para recuperar datos, selecciona un respaldo, revisa los registros de la vista previa y confirma la restauración. El archivo restaurado reemplaza los datos locales.
