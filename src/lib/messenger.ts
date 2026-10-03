// Arma el enlace de Messenger del refugio (SPEC 18). `cuenta` es lo que va después de m.me/:
// el usuario de la página o su id numérico, como lo guarda `refugio.messenger`.
// Meta no garantiza el mensaje prellenado, así que el mensaje se copia aparte (AvisoMensaje).
export function enlaceMessenger(cuenta: string): string {
	return `https://m.me/${cuenta}`;
}
