// Arma el enlace de WhatsApp, con mensaje prellenado si se da uno.
// `numero` va solo con dígitos y lada (el mismo formato que valida el esquema).
export function enlaceWhatsApp(numero: string, mensaje?: string): string {
	const enlace = `https://wa.me/${numero}`;
	return mensaje ? `${enlace}?text=${encodeURIComponent(mensaje)}` : enlace;
}
