// Arma el enlace de WhatsApp con mensaje prellenado.
// `numero` va solo con dígitos y lada (el mismo formato que valida el esquema).
export function enlaceWhatsApp(numero: string, mensaje: string): string {
	return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
}
