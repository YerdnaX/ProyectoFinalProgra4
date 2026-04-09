async function FinalizarOrden() {
    const ordenId = document.getElementById('orden-id').value
    if (!ordenId) {
        alert('No hay orden activa para esta mesa')
        return
    }

    const cuentaInput = document.getElementById('cuenta-bancaria')
    const numeroCuenta = cuentaInput ? cuentaInput.value.trim() : ''

    if (!numeroCuenta) {
        alert('Ingrese el número de cuenta bancaria del cliente para procesar el pago.')
        if (cuentaInput) cuentaInput.focus()
        return
    }

    // Validación básica de formato IBAN (debe empezar con letras y tener al menos 10 chars)
    var cuentaNorm = numeroCuenta.replace(/\s+/g, '').toUpperCase()
    if (cuentaNorm.length < 10 || !/^[A-Z]{2}/.test(cuentaNorm)) {
        alert('El número de cuenta no tiene un formato válido. Ejemplo: CR05 0123 0000 1234 5678 90')
        if (cuentaInput) cuentaInput.focus()
        return
    }

    const totalEl = document.getElementById('orden-total')
    const totalTexto = totalEl ? totalEl.value : '0'
    const totalNum = Number(totalTexto)

    if (!confirm(`¿Cobrar ₡${totalNum.toLocaleString('es-CR')} a la cuenta ${numeroCuenta} y cerrar la orden?`)) return

    try {
        const resp = await fetch('/api/pago-bancario', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ordenId: ordenId,
                numeroCuenta: cuentaNorm,
                moneda: 'CRC',
                descripcion: 'Pago factura orden #' + ordenId + ' - Restaurante PuraVia'
            })
        })
        const data = await resp.json()
        if (!resp.ok || data.error) {
            alert('No se pudo procesar el pago: ' + (data.error || 'Error desconocido'))
            return
        }
        alert('Pago realizado y orden cerrada correctamente.\nTotal cobrado: ₡' + (data.total || totalNum).toLocaleString('es-CR'))
        location.reload()
    } catch (err) {
        console.error(err)
        alert('Error de red al procesar el pago bancario')
    }
}

window.FinalizarOrden = FinalizarOrden

async function AgregarAOrden() {
    const ordenId = document.getElementById('orden-id').value
    if (!ordenId) {
        alert('No hay orden activa para esta mesa')
        return
    }
    const productoId = document.getElementById('producto').value
    const cantidad = parseInt(document.getElementById('cantidad').value, 10)
    const observaciones = document.getElementById('observaciones').value.trim()

    if (!productoId) {
        alert('Selecciona un producto')
        return
    }
    if (!cantidad || cantidad < 1) {
        alert('La cantidad debe ser mayor o igual a 1')
        return
    }

    try {
        const resp = await fetch(`/api/orden/${ordenId}/agregar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productoId, cantidad, observaciones })
        })
        const data = await resp.json()
        if (!resp.ok || data.error) {
            alert(data.error || 'No se pudo agregar el producto')
            return
        }
        location.reload()
    } catch (err) {
        console.error(err)
        alert('Error de red al agregar producto')
    }
}

window.AgregarAOrden = AgregarAOrden

async function ImprimirFactura() {
    const ordenId = document.getElementById('orden-id').value
    if (!ordenId) {
        alert('No hay orden activa para esta mesa')
        return
    }
    try {
        const resp = await fetch(`/api/orden/${ordenId}/imprimir`, { method: 'POST' })
        const data = await resp.json()
        if (!resp.ok || data.error) {
            alert(data.error || 'No se pudo generar la factura')
            return
        }
        alert(`Factura generada: ${data.archivo}`)
    } catch (err) {
        console.error(err)
        alert('Error de red al generar la factura')
    }
}

window.ImprimirFactura = ImprimirFactura
