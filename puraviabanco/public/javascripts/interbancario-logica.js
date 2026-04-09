(function () {

	function formatearMonto(valor, moneda) {
		var simbolo = moneda === 'USD' ? '$' : '₡';
		var numero = Number(valor || 0);
		var texto = new Intl.NumberFormat('es-CR', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		}).format(numero);
		return simbolo + ' ' + texto + ' ' + moneda;
	}

	function asignarTexto(id, valor) {
		var el = document.getElementById(id);
		if (el) {
			el.textContent = valor;
		}
	}

	function mostrarSeccion(id) {
		var el = document.getElementById(id);
		if (el) {
			el.style.display = 'block';
			el.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
	}

	// ------------------------------------------------------------
	// ENVIAR POR TELÉFONO
	// ------------------------------------------------------------

	function leerFormularioEnvio() {
		return {
			ibanOrigen:       (document.getElementById('env-iban-origen')       || {}).value,
			telefonoDestino:  (document.getElementById('env-telefono-destino')  || {}).value,
			monto:            (document.getElementById('env-monto')             || {}).value,
			moneda:           (document.getElementById('env-moneda')            || {}).value,
			descripcion:      (document.getElementById('env-descripcion')       || {}).value
		};
	}

	function validarFormularioEnvio(datos) {
		if (!datos.ibanOrigen || !datos.ibanOrigen.trim()) {
			alert('Ingrese el IBAN de la cuenta origen.');
			return false;
		}
		if (!datos.telefonoDestino || !datos.telefonoDestino.trim()) {
			alert('Ingrese el teléfono del destinatario.');
			return false;
		}
		var monto = Number(datos.monto);
		if (!monto || monto <= 0) {
			alert('El monto debe ser mayor a cero.');
			return false;
		}
		return true;
	}

	function mostrarResultadoEnvio(data) {
		if (!data) return;
		asignarTexto('env-res-codigo',       data.codigoOperacion  || 'N/D');
		asignarTexto('env-res-iban-origen',  data.ibanOrigen       || 'N/D');
		asignarTexto('env-res-banco-destino',data.bancoDestino     || 'N/D');
		asignarTexto('env-res-iban-destino', data.ibanDestino      || 'N/D');
		asignarTexto('env-res-monto',        formatearMonto(data.montoTransferido, data.moneda || 'CRC'));
		asignarTexto('env-res-moneda',       data.moneda           || 'N/D');
		mostrarSeccion('resultado-envio');
	}

	async function manejarEnvioPorTelefono(event) {
		event.preventDefault();
		var boton = event.currentTarget;
		var datos = leerFormularioEnvio();

		if (!validarFormularioEnvio(datos)) return;

		var payload = {
			ibanOrigen:      datos.ibanOrigen.replace(/\s+/g, '').toUpperCase(),
			telefonoDestino: datos.telefonoDestino.trim(),
			monto:           Number(datos.monto),
			moneda:          datos.moneda,
			descripcion:     datos.descripcion.trim() || 'Transferencia interbancaria por telefono'
		};

		if (boton) boton.disabled = true;

		try {
			var respuesta = await fetch('/interbancario/enviar-por-telefono', {
				method:  'POST',
				headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
				body:    JSON.stringify(payload)
			});
			var data = await respuesta.json().catch(function () { return {}; });

			if (respuesta.ok && data.ok) {
				alert(data.message || 'Transferencia realizada correctamente.');
				mostrarResultadoEnvio(data.data || {});
				return;
			}

			alert(data.message || 'No se pudo realizar la transferencia.');
		} catch (error) {
			alert('No fue posible comunicarse con el servidor.');
		} finally {
			if (boton) boton.disabled = false;
		}
	}

	// ------------------------------------------------------------
	// TRAER DESDE OTRO BANCO
	// ------------------------------------------------------------

	function leerFormularioTraer() {
		return {
			ibanOrigen:   (document.getElementById('traer-iban-origen')   || {}).value,
			ibanDestino:  (document.getElementById('traer-iban-destino')  || {}).value,
			monto:        (document.getElementById('traer-monto')         || {}).value,
			moneda:       (document.getElementById('traer-moneda')        || {}).value,
			descripcion:  (document.getElementById('traer-descripcion')   || {}).value
		};
	}

	function validarFormularioTraer(datos) {
		if (!datos.ibanOrigen || !datos.ibanOrigen.trim()) {
			alert('Ingrese el IBAN de la cuenta origen en el banco externo.');
			return false;
		}
		if (!datos.ibanDestino || !datos.ibanDestino.trim()) {
			alert('Ingrese el IBAN de la cuenta destino en Banco A.');
			return false;
		}
		var monto = Number(datos.monto);
		if (!monto || monto <= 0) {
			alert('El monto debe ser mayor a cero.');
			return false;
		}
		return true;
	}

	function mostrarResultadoTraer(data) {
		if (!data) return;
		asignarTexto('traer-res-codigo',      data.codigoOperacion || 'N/D');
		asignarTexto('traer-res-banco-origen', data.bancoOrigen    || 'N/D');
		asignarTexto('traer-res-iban-origen',  data.ibanOrigen     || 'N/D');
		asignarTexto('traer-res-iban-destino', data.ibanDestino    || 'N/D');
		asignarTexto('traer-res-monto',        formatearMonto(data.montoTransferido, data.moneda || 'CRC'));
		asignarTexto('traer-res-moneda',       data.moneda         || 'N/D');
		mostrarSeccion('resultado-traer');
	}

	async function manejarTraerDesdeOtroBanco(event) {
		event.preventDefault();
		var boton = event.currentTarget;
		var datos = leerFormularioTraer();

		if (!validarFormularioTraer(datos)) return;

		var payload = {
			ibanOrigen:  datos.ibanOrigen.replace(/\s+/g, '').toUpperCase(),
			ibanDestino: datos.ibanDestino.replace(/\s+/g, '').toUpperCase(),
			monto:       Number(datos.monto),
			moneda:      datos.moneda,
			descripcion: datos.descripcion.trim() || 'Traida de fondos desde banco externo'
		};

		if (boton) boton.disabled = true;

		try {
			var respuesta = await fetch('/interbancario/traer-desde-otro-banco', {
				method:  'POST',
				headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
				body:    JSON.stringify(payload)
			});
			var data = await respuesta.json().catch(function () { return {}; });

			if (respuesta.ok && data.ok) {
				alert(data.message || 'Fondos traídos correctamente.');
				mostrarResultadoTraer(data.data || {});
				return;
			}

			alert(data.message || 'No se pudo completar la operación.');
		} catch (error) {
			alert('No fue posible comunicarse con el servidor.');
		} finally {
			if (boton) boton.disabled = false;
		}
	}

	// ------------------------------------------------------------
	// Inicialización
	// ------------------------------------------------------------

	document.addEventListener('DOMContentLoaded', function () {
		var botonEnviar = document.getElementById('btn-enviar-por-telefono');
		if (botonEnviar) {
			botonEnviar.addEventListener('click', manejarEnvioPorTelefono);
		}

		var botonTraer = document.getElementById('btn-traer-desde-otro-banco');
		if (botonTraer) {
			botonTraer.addEventListener('click', manejarTraerDesdeOtroBanco);
		}
	});

})();
