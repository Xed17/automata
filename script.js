// Estado del Autómata (FSM)
let currentState = 'INACTIVO';
let selectedProduct = null;
let targetPrice = 0.0;
let accumulatedBalance = 0.0;
let changeReturn = 0.0;
let FSM_TABLE = {};

// Catálogo de Productos
const PRODUCTOS = {
  agua: { nombre: 'Agua Mineral', precio: 1.50, icon: 'water_drop' }
};

// Generador Dinámico de la Tabla de Transiciones (FSM)
function generarTablaTransiciones(price) {
  const table = {};
  const coinValues = [0.1, 0.2, 0.5, 1.0, 2.0, 5.0];
  const maxCoinsState = Math.round(price * 10);
  
  // Generar estados desde q_0_0 hasta q_(price-0.1)
  for (let i = 0; i < maxCoinsState; i++) {
    const balance = Number((i / 10).toFixed(1));
    const stateName = obtenerNombreEstado(balance);
    table[stateName] = {};
    
    // Asignar transiciones para cada moneda
    coinValues.forEach(coin => {
      const nextBalance = Number((balance + coin).toFixed(1));
      const inputName = `MONEDA_${coin.toFixed(1)}`;
      
      if (nextBalance >= price) {
        table[stateName][inputName] = 'q_exito';
      } else {
        table[stateName][inputName] = obtenerNombreEstado(nextBalance);
      }
    });
    
    // Transición de intento de retiro sin saldo suficiente -> ERROR (Bloqueo)
    table[stateName]['ACCION_RETIRAR'] = 'q_error';
  }
  
  // Transiciones desde el estado de Éxito
  table['q_exito'] = {
    'RESET': 'q_0_0'
  };
  
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
        calculatedChange = Number((accumulatedBalance + coinInserted - targetPrice).toFixed(2));
      }
    }

    // Actualizar matemáticamente el estado
    currentState = nextState;
    
    // Sincronizar el saldo basado en el nuevo estado
    if (currentState === 'q_exito') {
      changeReturn = calculatedChange;
      accumulatedBalance = targetPrice;
    } else if (currentState !== 'q_error') {
      accumulatedBalance = obtenerBalanceDeEstado(currentState);
    }

    // Log en consola para depuración académica de transiciones
    console.log(`Transición: δ(${currentState}, ${input}) ➔ ${nextState}`);
    
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
    btn.disabled = (currentState === 'INACTIVO' || currentState === 'q_exito' || currentState === 'q_error');
  });

  // 5. Renderizar Monedas de Vuelto
  renderizarVuelto(changeReturn);
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

// Inicialización de la máquina al cargar
window.addEventListener('DOMContentLoaded', () => {
  console.log('Sistema de Autómata Expendedor FSM inicializado.');
});
