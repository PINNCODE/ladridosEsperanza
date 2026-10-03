// Arma el enlace de WhatsApp de un negocio, con mensaje prellenado si se da uno. El refugio no tiene
// WhatsApp: su contacto es Messenger (messenger.ts, SPEC 18).
// `numero` va solo con dígitos y lada (el mismo formato que valida el esquema).
export function enlaceWhatsApp(numero: string, mensaje?: string): string {
	const enlace = `https://wa.me/${numero}`;
	return mensaje ? `${enlace}?text=${encodeURIComponent(mensaje)}` : enlace;
}
