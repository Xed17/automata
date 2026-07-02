Esta es la guía de diseño e implementación arquitectónica para construir una máquina automática utilizando los fundamentos rigurosos de las **Máquinas de Estado Finito (MEF)**.

El objetivo es modelar un sistema determinístico e interactivo con **HTML, CSS y JavaScript Vanilla**, donde la lógica de la aplicación esté gobernada al 100% por un autómata formal, imitando el comportamiento de los sistemas reales analizados en clase.

---

## 🗺️ Fase 1: El Modelo Matemático (Abstracción)

Antes de escribir código, debes definir los límites de tu autómata $M = \langle Q, \Sigma, \delta \rangle$. Aunque tienes total libertad para elegir las reglas de negocio (como el precio del producto), la estructura formal debe quedar clara:

* **Precio Objetivo ($Monto$):** Elige un costo fijo para el producto (por ejemplo, $S/. 1.50$, $S/. 2.00$ o $S/. 3.00$). Acotar el precio te ayudará a mantener un número manejable de estados intermedios.
* 
**Conjunto de Estados ($Q$):** Modela cada nodo del sistema. Debe existir obligatoriamente un estado inicial ($0.0$ soles depositados) , múltiples estados intermedios que representen el dinero acumulado exacto, al menos un **estado de aceptación** (monto completado), y el estado crítico de **Bloqueo/Error** exigido por la actividad.


* 
**Alfabeto de Entradas ($\Sigma$):** Define los estímulos que la máquina aceptará. Tu alfabeto obligatorio incluirá las monedas elegibles ($0.2, 0.5, 1, 2$ y $5$ soles) y acciones del usuario (como "Intentar retirar producto").


* 
**Función de Transición ($\delta$):** Es el mapa que dicta cómo pasar de un estado a otro dada una entrada específica ($Q \times \Sigma \rightarrow Q$). **Regla de Oro:** Para que sea determinística, cada celda de tu matriz de adyacencia debe apuntar a un único estado. Cualquier estímulo prohibido en un estado intermedio (por ejemplo, presionar retirar sin saldo suficiente) debe transicionar directamente al estado de **Bloqueo/Error**.



---

## 💻 Fase 2: Arquitectura del Código (Estructura en JavaScript)

Para que el proyecto refleje fielmente la teoría de autómatas, se recomienda separar limpiamente el "motor" del autómata de la interfaz gráfica.

### 1. Representación de la Tabla de Transición

Implementa la **Tabla del Siguiente Estado** utilizando un objeto JSON estructurado. Esto evitará tener un código lleno de condicionales `if/else` interminables y desordenados, manteniendo la elegancia del modelo matemático:

```javascript
// Ejemplo conceptual de la matriz de transición
const FSM_TABLE = {
  'ESTADO_0_SOLES': {
    'MONEDA_0.2': 'ESTADO_0.2_SOLES',
    'MONEDA_1.0': 'ESTADO_1.0_SOL',
    'ACCION_RETIRAR': 'ESTADO_ERROR' // Bloqueo instantáneo por acción inválida
  },
  'ESTADO_0.2_SOLES': {
    'MONEDA_0.2': 'ESTADO_0.4_SOLES',
    'MONEDA_1.0': 'ESTADO_1.2_SOLES',
    'ACCION_RETIRAR': 'ESTADO_ERROR'
  },
  // ... Define aquí el resto de combinaciones de tu mapa de estados
  'ESTADO_EXITO': {
    'RESET': 'ESTADO_0_SOLES'
  },
  'ESTADO_ERROR': {
    // Si la máquina se bloquea, ignora nuevas monedas (se queda en ERROR)
    'MONEDA_0.2': 'ESTADO_ERROR',
    'MONEDA_1.0': 'ESTADO_ERROR',
    'RESET': 'ESTADO_0_SOLES' // Única forma de salir del bucle de falla
  }
};

```

### 2. El Motor del Autómata

Utiliza una variable global controlada para almacenar el **Estado Actual** (`let currentState = 'ESTADO_0_SOLES';`). Toda interacción del usuario debe pasar por una única función central de cambio de estado:

```javascript
function enviarEstimulo(input) {
  // 1. Validar si la transición existe en la tabla para el estado actual
  if (FSM_TABLE[currentState] && FSM_TABLE[currentState][input]) {
    // 2. Actualizar matemáticamente el estado
    currentState = FSM_TABLE[currentState][input];
    
    // 3. Sincronizar la interfaz visual
    renderizarInterfaz();
  }
}

```

---

## 🎨 Fase 3: La Interfaz de Usuario (HTML y CSS)

El diseño visual es completamente libre, pero debe funcionar como un reflejo en tiempo real del estado interno del autómata. Considera estructurar la pantalla en tres zonas clave:

1. 
**Panel de Control y Ranura:** Los botones interactivos que disparan los estímulos del alfabeto $\Sigma$ (las monedas y las palancas de retiro).


2. **Pantalla de Diagnóstico (Display):** Una sección que le muestre claramente al profesor el estado actual exacto en el que se encuentra el software (ej: `Estado Activo: q_sub_1.5` o `Monto: S/. 1.50`).
3. **Mecanismo de Respuesta (Feedback Visual):**
* 
**En Éxito:** Cambia el estilo o activa una animación en el dispensador de productos cuando `currentState === 'ESTADO_EXITO'`.


* 
**En Bloqueo:** Cuando el sistema pase a `'ESTADO_ERROR'`, tiñe la interfaz con alertas visuales drásticas (pantalla roja, deshabilitación de los botones de monedas, texto de "SISTEMA BLOQUEADO") para demostrar que la máquina ha quedado inutilizable hasta presionar un botón físico de *Reset*.





---

## 📝 Lista de Verificación para la Entrega

Para asegurar que se cumplan todos los objetivos académicos evaluados por tu profesor, verifica que tu proyecto final cuente con:

* [ ] **Código fuente desacoplado:** La lógica de estados (`FSM_TABLE`) está claramente separada de la manipulación de etiquetas HTML.
* [ ] **Determinismo estricto:** No existen ambigüedades; una moneda en un estado específico siempre produce el mismo resultado predecible.


* [ ] **Rutina de Error robusta:** La máquina efectivamente se congela y rechaza operaciones adicionales si se cae en el estado de bloqueo involuntario.


* [ ] **Documentación teórica (Opcional pero recomendado):** Un pequeño diagrama de círculos y flechas (grafo de transición) que coincida exactamente con las llaves y propiedades programadas en tu objeto JavaScript.