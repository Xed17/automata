// Estado del Autómata (FSM)
let currentState = 'INACTIVO';
let selectedProduct = null;
let targetPrice = 0.0;
let accumulatedBalance = 0.0;
let changeReturn = 0.0;
let lastStateBeforeAccept = null;
let FSM_TABLE = {};

// Catálogo de Productos
const PRODUCTOS = {
  agua: { nombre: 'Agua Mineral', precio: 1.50, icon: 'water_drop' },
  jugo: { nombre: 'Jugo Fruta', precio: 1.80, icon: 'bubble_chart' },
  galletas: { nombre: 'Galletas', precio: 1.20, icon: 'cookie' },
  chocolate: { nombre: 'Chocolate', precio: 3.00, icon: 'inventory_2' },
  gaseosa: { nombre: 'Gaseosa Cola', precio: 2.00, icon: 'local_drink' },
  papas: { nombre: 'Papas Fritas', precio: 2.50, icon: 'fastfood' }
};

// Generador Dinámico de la Tabla de Transiciones (FSM)
function generarTablaTransiciones(price) {
  const table = {};
  const coinValues = [0.1, 0.2, 0.5, 1.0, 2.0, 5.0];
  const nodes = obtenerNodosMostrar(price);
  const finalState = obtenerNombreEstado(price);
  
  nodes.forEach(val => {
    const stateName = obtenerNombreEstado(val);
    if (stateName === finalState) return; // Se maneja como q_exito en el motor
    
    table[stateName] = {};
    
    coinValues.forEach(coin => {
      const nextBalance = Number((val + coin).toFixed(1));
      const inputName = `MONEDA_${coin.toFixed(1)}`;
      
      if (nextBalance >= price) {
        table[stateName][inputName] = 'q_exito';
      } else {
        table[stateName][inputName] = obtenerNombreEstado(nextBalance);
      }
    });
    
    table[stateName]['ACCION_RETIRAR'] = 'q_error';
  });
  
  // Transiciones desde el estado de Éxito
  table['q_exito'] = {
    'RESET': 'q_0_0'
  };
  coinValues.forEach(coin => {
    const inputName = `MONEDA_${coin.toFixed(1)}`;
    if (coin >= price) {
      table['q_exito'][inputName] = 'q_exito';
    } else {
      table['q_exito'][inputName] = obtenerNombreEstado(coin);
    }
  });
  
  // Transiciones desde el estado de Error
  table['q_error'] = {
    'RESET': 'q_0_0'
  };
  
  return table;
}

// Convertir un valor decimal a un nombre de estado (ej: 1.2 -> q_1_2)
function obtenerNombreEstado(value) {
  const parts = value.toFixed(1).split('.');
  return `q_${parts[0]}_${parts[1]}`;
}

// Convertir un nombre de estado a su valor decimal (ej: q_1_2 -> 1.2)
function obtenerBalanceDeEstado(stateName) {
  if (stateName === 'q_exito') return targetPrice;
  if (stateName === 'q_error') return accumulatedBalance; // Mantiene el saldo previo
  
  const match = stateName.match(/^q_(\d+)_(\d+)$/);
  if (match) {
    return Number(`${match[1]}.${match[2]}`);
  }
  return 0.0;
}

// Función Principal: Motor de la Máquina de Estado Finito
function enviarEstimulo(input) {
  if (currentState === 'INACTIVO') {
    console.warn('Debe seleccionar un producto primero.');
    return;
  }

  // Verificar si la transición existe para el estado actual
  const transitionState = FSM_TABLE[currentState];
  if (transitionState && transitionState[input] !== undefined) {
    const nextState = transitionState[input];
    
    // Cálculo de vuelto en caso de inserción de moneda que supera el precio
    let calculatedChange = 0.0;
    if (input.startsWith('MONEDA_')) {
      const coinInserted = Number(input.split('_')[1]);
      if (nextState === 'q_exito') {
        const baseBalance = (currentState === 'q_exito') ? 0.0 : accumulatedBalance;
        calculatedChange = Number((baseBalance + coinInserted - targetPrice).toFixed(2));
      }
    }

    // Log en consola para depuración académica de transiciones (antes de actualizar)
    const prevState = currentState;

    // Guardar el estado previo si estamos transicionando al estado de aceptación
    if (nextState === 'q_exito') {
      lastStateBeforeAccept = currentState;
    }

    // Actualizar matemáticamente el estado
    currentState = nextState;
    
    // Sincronizar el saldo basado en el nuevo estado
    if (currentState === 'q_exito') {
      changeReturn = calculatedChange;
      accumulatedBalance = targetPrice;
    } else if (currentState !== 'q_error') {
      accumulatedBalance = obtenerBalanceDeEstado(currentState);
      changeReturn = 0.0;
    }

    console.log(`Transición: δ(${prevState}, ${input}) ➔ ${nextState}`);
    
    // Sincronizar y renderizar interfaz
    renderizarInterfaz();
  } else {
    // Si no hay transición válida, se considera estímulo rechazado
    if (currentState === 'q_exito' || currentState === 'q_error') {
      flashDispenserReturn();
    }
  }
}

// Interacción del Usuario: Selección de Producto
function seleccionarProducto(productKey, price) {
  if (currentState !== 'INACTIVO' && currentState !== 'q_0_0') {
    // Si ya hay transiciones en curso, no permitir cambiar hasta hacer reset
    console.warn('No puede cambiar de producto mientras hay saldo acumulado. Cancele o reinicie.');
    return;
  }

  selectedProduct = productKey;
  targetPrice = price;
  accumulatedBalance = 0.0;
  changeReturn = 0.0;
  lastStateBeforeAccept = null;
  
  // Inicializar autómata en q_0_0 y generar su tabla
  currentState = 'q_0_0';
  FSM_TABLE = generarTablaTransiciones(targetPrice);
  
  // Actualizar tarjetas en la interfaz
  document.querySelectorAll('.product-card').forEach(card => {
    card.classList.remove('selected');
  });
  document.getElementById(`prod-${productKey}`).classList.add('selected');
  
  // Habilitar monedas
  document.querySelectorAll('.coin-btn').forEach(btn => {
    btn.disabled = false;
  });

  // Generar FSM dinámica (Tabla y Grafo SVG)
  renderizarTablaTransicionDinamica(targetPrice);
  renderizarGrafoSVGDinamico(targetPrice);

  renderizarInterfaz();
}

// Interacción del Usuario: Insertar Moneda
function insertarMoneda(val) {
  enviarEstimulo(`MONEDA_${val.toFixed(1)}`);
}

// Interacción del Usuario: Botón Contextual (Acción Principal)
function ejecutarAccionContextual() {
  if (currentState === 'q_exito') {
    // Recoger el producto y hacer RESET
    enviarEstimulo('RESET');
    // Limpiar selección de producto de vuelta al estado INACTIVO
    restablecerTodo();
  } else if (currentState === 'q_error') {
    // Reiniciar máquina a q_0_0 conservando el producto actual
    enviarEstimulo('RESET');
  } else {
    // Intentar retirar antes de pagar el precio
    enviarEstimulo('ACCION_RETIRAR');
  }
}

// Restablecer por completo el sistema
function restablecerTodo() {
  currentState = 'INACTIVO';
  selectedProduct = null;
  targetPrice = 0.0;
  accumulatedBalance = 0.0;
  changeReturn = 0.0;
  lastStateBeforeAccept = null;
  FSM_TABLE = {};

  document.querySelectorAll('.product-card').forEach(card => {
    card.classList.remove('selected');
  });
  document.querySelectorAll('.coin-btn').forEach(btn => {
    btn.disabled = true;
  });

  renderizarInterfaz();
}

// Efecto visual si se inserta moneda estando bloqueado/exitoso
function flashDispenserReturn() {
  const dispenser = document.getElementById('dispenser-slot');
  if (!dispenser) return;
  dispenser.style.borderColor = 'var(--md-sys-color-error)';
  setTimeout(() => {
    dispenser.style.borderColor = 'var(--md-sys-color-outline)';
  }, 500);
}

// Actualizar la interfaz en base al estado de la FSM
function renderizarInterfaz() {
  // 1. LCD Display Updates
  const stateDisplay = document.getElementById('lcd-state');
  const productDisplay = document.getElementById('lcd-product');
  const costDisplay = document.getElementById('lcd-cost');
  const balanceDisplay = document.getElementById('lcd-balance');
  const statusMsg = document.getElementById('lcd-status-msg');
  const lcdDisplay = document.getElementById('lcd-display');

  if (!stateDisplay || !productDisplay || !costDisplay || !balanceDisplay || !statusMsg || !lcdDisplay) return;

  // Clases LCD de Estado
  lcdDisplay.classList.remove('lcd-error', 'lcd-success');

  if (currentState === 'INACTIVO') {
    stateDisplay.innerText = 'INACTIVO';
    productDisplay.innerText = 'NINGUNO';
    costDisplay.innerText = 'S/. 0.00';
    balanceDisplay.innerText = 'S/. 0.00';
    statusMsg.innerText = 'Seleccione un producto para iniciar';
  } else {
    stateDisplay.innerText = currentState.toUpperCase();
    productDisplay.innerText = PRODUCTOS[selectedProduct].nombre.toUpperCase();
    costDisplay.innerText = `S/. ${targetPrice.toFixed(2)}`;
    balanceDisplay.innerText = `S/. ${accumulatedBalance.toFixed(2)}`;

    if (currentState === 'q_exito') {
      lcdDisplay.classList.add('lcd-success');
      statusMsg.innerText = '¡MONTO COMPLETADO! Presione "Recoger Producto"';
    } else if (currentState === 'q_error') {
      lcdDisplay.classList.add('lcd-error');
      statusMsg.innerText = 'SISTEMA BLOQUEADO: Acción de retiro no válida. Presione "Reiniciar"';
    } else {
      const faltante = (targetPrice - accumulatedBalance).toFixed(2);
      statusMsg.innerText = `Falta ingresar: S/. ${faltante}`;
    }
  }

  // 2. Control Button Contextual Updates
  const actionBtn = document.getElementById('btn-action');
  const actionBtnText = document.getElementById('btn-action-text');
  const actionBtnIcon = document.getElementById('btn-action-icon');

  if (actionBtn && actionBtnText && actionBtnIcon) {
    actionBtn.classList.remove('btn-error', 'btn-success');
    actionBtn.disabled = (currentState === 'INACTIVO');

    if (currentState === 'INACTIVO') {
      actionBtnText.innerText = 'Intentar Retirar';
      actionBtnIcon.innerText = 'shopping_bag';
    } else if (currentState === 'q_exito') {
      actionBtn.classList.add('btn-success');
      actionBtnText.innerText = 'Recoger Producto';
      actionBtnIcon.innerText = 'done_all';
    } else if (currentState === 'q_error') {
      actionBtn.classList.add('btn-error');
      actionBtnText.innerText = 'Reiniciar Máquina';
      actionBtnIcon.innerText = 'restart_alt';
    } else {
      actionBtnText.innerText = 'Intentar Retirar';
      actionBtnIcon.innerText = 'shopping_bag';
    }
  }

  // 3. Dispensador Físico
  const dispenser = document.getElementById('dispenser-slot');
  const dispenserIcon = document.getElementById('dispenser-icon');
  const dispenserText = document.getElementById('dispenser-text');

  if (dispenser && dispenserIcon && dispenserText) {
    if (currentState === 'q_exito') {
      dispenser.classList.add('dispensed');
      dispenserIcon.innerText = PRODUCTOS[selectedProduct].icon;
      dispenserText.innerText = `¡Tu ${PRODUCTOS[selectedProduct].nombre}!`;
    } else {
      dispenser.classList.remove('dispensed');
      dispenserIcon.innerText = 'inbox';
      dispenserText.innerText = 'Vacío';
    }
  }

  // 4. Habilitar/Deshabilitar Monedas
  // Si está en error o exito, las monedas deben estar deshabilitadas
  document.querySelectorAll('.coin-btn').forEach(btn => {
    btn.disabled = (currentState === 'INACTIVO' || currentState === 'q_error');
  });

  // 5. Renderizar Monedas de Vuelto
  renderizarVuelto(changeReturn);

  // 6. Sincronizar Panel Académico (Tabla y Grafo)
  sincronizarPanelAcademico();
}

// Sincronizar el estado del panel académico con la FSM
function sincronizarPanelAcademico() {
  // Limpiar clases previas de filas y nodos
  document.querySelectorAll('.transition-table tbody tr').forEach(row => {
    row.classList.remove('row-active');
  });
  document.querySelectorAll('.graph-node-group').forEach(node => {
    node.classList.remove('active');
    node.classList.remove('change-state');
  });

  // Limpiar clases previas de transiciones y etiquetas
  document.querySelectorAll('.trans-path').forEach(path => {
    path.classList.remove('active-trans');
    path.classList.remove('change-trans');
  });
  document.querySelectorAll('.trans-label').forEach(label => {
    label.classList.remove('active-label');
    label.classList.remove('change-label');
  });

  if (currentState === 'INACTIVO') return;

  const finalState = obtenerNombreEstado(targetPrice);
  let rowId = '';
  let nodeId = '';

  if (currentState === 'q_exito') {
    rowId = `row-${finalState}`;
    nodeId = `node-${finalState}`;
  } else if (currentState === 'q_error') {
    // No resaltar en caso de error
    return;
  } else {
    const bal = obtenerBalanceDeEstado(currentState);

    if (bal >= targetPrice) {
      rowId = `row-${finalState}`;
      nodeId = `node-${finalState}`;
    } else {
      const stateLabel = obtenerNombreEstado(bal);
      rowId = `row-${stateLabel}`;
      nodeId = `node-${stateLabel}`;
    }
  }

  // Activar fila y nodo correspondientes
  const activeRow = document.getElementById(rowId);
  const activeNode = document.getElementById(nodeId);

  if (activeRow) activeRow.classList.add('row-active');
  if (activeNode) activeNode.classList.add('active');

  // Resaltar transiciones salientes del estado actual
  let activeStateName = '';
  if (currentState !== 'q_exito' && currentState !== 'q_error' && currentState !== 'INACTIVO') {
    activeStateName = currentState;
  }

  if (activeStateName) {
    document.querySelectorAll(`.trans-path[data-from="${activeStateName}"]`).forEach(path => {
      path.classList.add('active-trans');
    });
    document.querySelectorAll(`.trans-label[data-from="${activeStateName}"]`).forEach(label => {
      label.classList.add('active-label');
    });
  }

  // Cuando estamos en q_exito: resaltar la flecha específica que se tomó y mostrar el vuelto
  if (currentState === 'q_exito' && lastStateBeforeAccept) {
    const fromName = lastStateBeforeAccept;
    const toName = finalState;

    // Resaltar la flecha específica de la transición final
    const transPath = document.getElementById(`arrow-${fromName}-to-${toName}`);
    if (transPath) {
      transPath.classList.add('active-trans');
    }

    // Resaltar su etiqueta
    document.querySelectorAll(`.trans-label[data-from="${fromName}"]`).forEach(label => {
      label.classList.add('active-label');
    });

    // Resaltar también el nodo de origen
    const fromNode = document.getElementById(`node-${fromName}`);
    if (fromNode) fromNode.classList.add('active');

    // Mostrar la etiqueta dinámica de vuelto sobre el nodo de aceptación
    const svgContainer = document.getElementById('svg-dynamic-content');
    const acceptNode = document.getElementById(`node-${toName}`);
    if (svgContainer && acceptNode && changeReturn >= 0) {
      // Eliminar etiqueta de vuelto anterior si existe
      const prevChangeLabel = document.getElementById('dynamic-change-label');
      if (prevChangeLabel) prevChangeLabel.remove();

      // Obtener posición del nodo de aceptación
      const circle = acceptNode.querySelector('circle');
      if (circle) {
        const cx = parseFloat(circle.getAttribute('cx'));
        const cy = parseFloat(circle.getAttribute('cy'));

        const changeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        changeGroup.setAttribute('id', 'dynamic-change-label');

        // Fondo del badge
        const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        const labelText = `Vuelto: S/. ${changeReturn.toFixed(2)}`;
        const textWidth = labelText.length * 6.5;
        bg.setAttribute('x', (cx - textWidth / 2 - 6).toString());
        bg.setAttribute('y', (cy + 30).toString());
        bg.setAttribute('width', (textWidth + 12).toString());
        bg.setAttribute('height', '22');
        bg.setAttribute('rx', '6');
        bg.setAttribute('fill', '#059669');
        bg.setAttribute('opacity', '0.95');
        changeGroup.appendChild(bg);

        // Texto del vuelto
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', cx.toString());
        text.setAttribute('y', (cy + 45).toString());
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', '#ffffff');
        text.setAttribute('font-family', "'Share Tech Mono', monospace");
        text.setAttribute('font-size', '11');
        text.setAttribute('font-weight', '700');
        text.textContent = labelText;
        changeGroup.appendChild(text);

        svgContainer.appendChild(changeGroup);
      }
    }

    // Resaltar los nodos que representan el vuelto (descomposición en monedas)
    if (changeReturn > 0) {
      const denominations = [5.0, 2.0, 1.0, 0.5, 0.2, 0.1];
      let remaining = Math.round(changeReturn * 100) / 100;
      const changeStates = new Set();

      denominations.forEach(denom => {
        while (remaining >= denom - 0.001) {
          const stateName = obtenerNombreEstado(denom);
          changeStates.add(stateName);
          remaining = Math.round((remaining - denom) * 100) / 100;
        }
      });

      changeStates.forEach(stateName => {
        const changeNode = document.getElementById(`node-${stateName}`);
        if (changeNode) {
          changeNode.classList.add('change-state');
        }

        // Resaltar la flecha de transición desde q_0_0 al nodo de vuelto
        const pathEl = document.getElementById(`arrow-q_0_0-to-${stateName}`);
        if (pathEl) {
          pathEl.classList.add('change-trans');
        }

        // Resaltar la etiqueta de la transición correspondiente
        const labelEl = document.querySelector(`.trans-label[data-from="q_0_0"][data-to="${stateName}"]`);
        if (labelEl) {
          labelEl.classList.add('change-label');
        }
      });
    }
  }
}

// Renderizado visual de las monedas de vuelto entregadas
function renderizarVuelto(monto) {
  const coinsContainer = document.getElementById('change-coins-list');
  const placeholder = document.getElementById('change-placeholder');
  
  if (!coinsContainer || !placeholder) return;
  
  coinsContainer.innerHTML = '';
  
  if (monto <= 0) {
    placeholder.style.display = 'block';
    return;
  }
  
  placeholder.style.display = 'none';
  
  let remaining = Math.round(monto * 100) / 100;
  const denominaciones = [5.0, 2.0, 1.0, 0.5, 0.2, 0.1];
  
  denominaciones.forEach(denom => {
    while (remaining >= denom - 0.001) {
      const coinEl = document.createElement('div');
      const isGold = (denom === 5.0 || denom === 2.0);
      coinEl.className = `coin-returned ${isGold ? 'gold' : 'silver'}`;
      
      let displayVal = denom >= 1 ? denom.toFixed(0) : denom.toFixed(2);
      coinEl.innerHTML = `
        <span class="coin-symbol-sm">S/.</span>
        <span class="coin-val-sm">${displayVal}</span>
      `;
      coinsContainer.appendChild(coinEl);
      remaining = Math.round((remaining - denom) * 100) / 100;
    }
  });
}

// Helper para obtener todos los estados secuenciales en pasos de 0.10 y asegurar estados de monedas de vuelto
function obtenerNodosMostrar(price) {
  const steps = new Set();
  const maxStep = Math.round(price * 10);
  for (let i = 0; i <= maxStep; i++) {
    steps.add(Number((i / 10).toFixed(1)));
  }
  
  // Siempre asegurar que existan los estados correspondientes a las monedas físicas
  const coinValues = [0.1, 0.2, 0.5, 1.0, 2.0, 5.0];
  coinValues.forEach(c => {
    steps.add(c);
  });
  
  return Array.from(steps).sort((a, b) => a - b);
}

// Calcular trayectoria de curva cuadrática Bezier recortada en los bordes de los nodos circulares
function calcularRutaCurva(x1, y1, x2, y2, coin) {
  const r1 = 20;
  const r2 = 20;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  
  if (len === 0) return { d: '', labelX: x1, labelY: y1 };

  // Punto medio
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;

  // Desplazamiento perpendicular según la moneda para evitar cruces
  let offset = 12;
  if (coin === 0.2) offset = 22;
  else if (coin === 0.5) offset = 35;
  else if (coin === 1.0) offset = 50;
  else if (coin >= 2.0) offset = 65;

  // Vector perpendicular normalizado
  const px = -dy / len;
  const py = dx / len;

  // Punto de control Q
  const cx = mx + px * offset;
  const cy = my + py * offset;

  // Calcular distancias de control
  const d1 = Math.sqrt((cx - x1) * (cx - x1) + (cy - y1) * (cy - y1));
  const d2 = Math.sqrt((cx - x2) * (cx - x2) + (cy - y2) * (cy - y2));

  // Recortar puntos al radio del círculo
  const sx = x1 + ((cx - x1) / d1) * r1;
  const sy = y1 + ((cy - y1) / d1) * r1;
  const ex = x2 + ((cx - x2) / d2) * r2;
  const ey = y2 + ((cy - y2) / d2) * r2;

  // Ecuación de Bezier cuadrática para t = 0.25 (primera cuarta parte, cerca al origen)
  const t = 0.25;
  const labelX_base = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * cx + t * t * x2;
  const labelY_base = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * cy + t * t * y2;

  // Desplazar la etiqueta ligeramente perpendicular a la curva para legibilidad
  const labelX = labelX_base + px * 10;
  const labelY = labelY_base + py * 10;

  return {
    d: `M ${sx} ${sy} Q ${cx} ${cy} ${ex} ${ey}`,
    labelX,
    labelY
  };
}

// Renderizado dinámico de la Tabla de Transición
function renderizarTablaTransicionDinamica(price) {
  const tbody = document.getElementById('academic-transition-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const coinValues = [0.1, 0.2, 0.5, 1.0, 2.0, 5.0];
  const maxCoinsState = Math.round(price * 10);
  const stateNames = [];

  for (let i = 0; i <= maxCoinsState; i++) {
    const balance = Number((i / 10).toFixed(1));
    stateNames.push(obtenerNombreEstado(balance));
  }
  const finalState = obtenerNombreEstado(price);

  stateNames.forEach(state => {
    const isInitial = (state === 'q_0_0');
    const isFinal = (state === finalState);

    const row = document.createElement('tr');
    row.id = `row-${state}`;

    const symbolTd = document.createElement('td');
    symbolTd.className = 'state-symbol';
    if (isInitial) symbolTd.innerHTML = '&rarr;';
    else if (isFinal) symbolTd.innerHTML = '&bull;';
    row.appendChild(symbolTd);

    const nameTd = document.createElement('td');
    nameTd.className = 'state-name';
    if (isFinal) nameTd.classList.add('font-success');
    nameTd.innerText = state;
    row.appendChild(nameTd);

    coinValues.forEach(coin => {
      const td = document.createElement('td');
      if (isFinal) {
        if (coin >= price) {
          td.innerText = finalState;
        } else {
          td.innerText = obtenerNombreEstado(coin);
        }
      } else {
        const currentBalance = obtenerBalanceDeEstado(state);
        const nextBalance = Number((currentBalance + coin).toFixed(1));
        if (nextBalance >= price) {
          td.innerText = finalState;
        } else {
          td.innerText = obtenerNombreEstado(nextBalance);
        }
      }
      row.appendChild(td);
    });

    tbody.appendChild(row);
  });
}

// Renderizado dinámico del Diagrama de Transición SVG
function renderizarGrafoSVGDinamico(price) {
  const container = document.getElementById('svg-dynamic-content');
  const svg = document.getElementById('academic-transition-svg');
  if (!container || !svg) return;
  container.innerHTML = '';

  const nodes = obtenerNodosMostrar(price);
  const N = nodes.length;
  const M = N - 1; // cantidad de nodos periféricos

  // Calcular radios dinámicos: garantizar ~80px de separación de arco entre nodos
  // Perímetro de elipse ≈ π * sqrt(2*(rx² + ry²)). Usamos ry = rx * 0.42
  // P ≈ π * rx * sqrt(2*(1 + 0.42²)) ≈ π * rx * 1.535
  // P / M >= 80 → rx >= M * 80 / (π * 1.535) ≈ M * 16.6
  const rx_ellipse = Math.max(300, M * 16.6);
  const ry_ellipse = Math.round(rx_ellipse * 0.42);

  const svgWidth = Math.round(2 * rx_ellipse + 140);
  const svgHeight = Math.round(2 * ry_ellipse + 120);
  const cx_ellipse = Math.round(svgWidth / 2);
  const cy_ellipse = Math.round(svgHeight / 2);

  svg.setAttribute("viewBox", `0 0 ${svgWidth} ${svgHeight}`);
  svg.style.width = `${svgWidth}px`;
  svg.style.height = `${svgHeight}px`;

  // Calcular las coordenadas de los nodos
  const coords = [];

  for (let i = 0; i < M; i++) {
    // Distribuir en la elipse en sentido horario empezando del extremo izquierdo (Math.PI)
    const angle = Math.PI - i * (2 * Math.PI / M);
    coords.push({
      x: cx_ellipse + rx_ellipse * Math.cos(angle),
      y: cy_ellipse - ry_ellipse * Math.sin(angle)
    });
  }

  // Estado final en el centro geométrico
  coords.push({
    x: cx_ellipse,
    y: cy_ellipse
  });

  // 1. Dibujar flecha de inicio al estado inicial (q_0_0)
  const startX_init = 15;
  const endX_init = coords[0].x - 22; // al borde del círculo q_0_0
  const y_init = coords[0].y;
  
  const initPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  initPath.setAttribute("d", `M ${startX_init} ${y_init} L ${endX_init} ${y_init}`);
  initPath.setAttribute("stroke", "#64748b");
  initPath.setAttribute("stroke-width", "2");
  initPath.setAttribute("marker-end", "url(#arrow-init)");
  container.appendChild(initPath);

  // 2. Agrupar transiciones de la tabla para evitar solapamientos
  const transitionMap = {};
  const coinValues = [0.1, 0.2, 0.5, 1.0, 2.0, 5.0];

  for (let i = 0; i < M; i++) {
    coinValues.forEach(c => {
      const nextVal = Number((nodes[i] + c).toFixed(1));
      let targetIndex = N - 1; // último índice es aceptación por defecto
      
      if (nextVal < price) {
        targetIndex = nodes.indexOf(nextVal);
      }
      
      if (targetIndex !== -1) {
        const key = `${i}_to_${targetIndex}`;
        if (!transitionMap[key]) {
          transitionMap[key] = {
            from: i,
            to: targetIndex,
            coins: []
          };
        }
        if (!transitionMap[key].coins.includes(c)) {
          transitionMap[key].coins.push(c);
        }
      }
    });
  }

  // 3. Dibujar arcos y etiquetas de transición agrupados
  Object.values(transitionMap).forEach(trans => {
    const { from, to, coins } = trans;
    const stateNameFrom = obtenerNombreEstado(nodes[from]);
    const stateNameTo = obtenerNombreEstado(nodes[to]);
    
    const x1 = coords[from].x;
    const y1 = coords[from].y;
    const x2 = coords[to].x;
    const y2 = coords[to].y;

    // Usar la mediana del grupo de monedas para calcular la curvatura
    const sortedCoins = [...coins].sort((a, b) => a - b);
    const medianCoin = sortedCoins[Math.floor(sortedCoins.length / 2)];
    const pathData = calcularRutaCurva(x1, y1, x2, y2, medianCoin);

    if (pathData.d) {
      // Dibujar la curva
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", pathData.d);
      path.setAttribute("class", "trans-path");
      path.setAttribute("data-from", stateNameFrom);
      path.setAttribute("data-to", stateNameTo);
      path.setAttribute("id", `arrow-${stateNameFrom}-to-${stateNameTo}`);
      path.setAttribute("marker-end", "url(#arrow)");
      container.appendChild(path);

      // Dibujar la etiqueta
      const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.setAttribute("x", pathData.labelX.toString());
      label.setAttribute("y", pathData.labelY.toString());
      label.setAttribute("class", "trans-label");
      label.setAttribute("data-from", stateNameFrom);
      label.setAttribute("data-to", stateNameTo);

      // Formato compacto: solo el valor de la moneda
      const coinsStr = coins.map(c => c >= 1 ? c.toFixed(0) : c.toFixed(2)).join(",");
      label.textContent = coinsStr;
      container.appendChild(label);
    }
  });

  // 4. Dibujar Nodos Circulares (Estados)
  nodes.forEach((val, i) => {
    const x = coords[i].x;
    const y = coords[i].y;
    const isFinal = (i === N - 1);
    const stateName = obtenerNombreEstado(val);

    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.setAttribute("class", "graph-node-group");
    if (isFinal) group.classList.add("success-node");
    group.setAttribute("id", `node-${stateName}`);

    if (isFinal) {
      const outerCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      outerCircle.setAttribute("cx", x.toString());
      outerCircle.setAttribute("cy", y.toString());
      outerCircle.setAttribute("r", "22");
      outerCircle.setAttribute("class", "node-circle-outer");
      group.appendChild(outerCircle);

      const innerCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      innerCircle.setAttribute("cx", x.toString());
      innerCircle.setAttribute("cy", y.toString());
      innerCircle.setAttribute("r", "18");
      innerCircle.setAttribute("class", "node-circle");
      group.appendChild(innerCircle);
    } else {
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", x.toString());
      circle.setAttribute("cy", y.toString());
      circle.setAttribute("r", "20");
      circle.setAttribute("class", "node-circle");
      group.appendChild(circle);
    }

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", x.toString());
    text.setAttribute("y", (y + 4).toString());
    text.setAttribute("class", "node-text");
    text.textContent = stateName;
    group.appendChild(text);

    container.appendChild(group);
  });
}

// Inicialización de la máquina al cargar
window.addEventListener('DOMContentLoaded', () => {
  console.log('Sistema de Autómata Expendedor FSM inicializado.');
  seleccionarProducto('agua', 1.50);
});
