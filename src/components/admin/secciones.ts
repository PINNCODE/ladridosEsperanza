// Las 6 secciones de bloques_contenido que se editan en /admin/textos (SPEC 08), con su nombre
// legible y dónde se ven. En las de `soloPrimero`, el sitio muestra solo el primer bloque publicado.

export type Seccion = { valor: string; nombre: string; pagina: string; soloPrimero: boolean };

export const secciones: Seccion[] = [
	{ valor: 'quienes_somos', nombre: 'Quiénes somos', pagina: 'Portada', soloPrimero: true },
	{ valor: 'proceso_adopcion', nombre: 'Proceso de adopción', pagina: '/adopta', soloPrimero: true },
	{ valor: 'esterilizacion_por_que', nombre: 'Por qué esterilizar', pagina: '/esterilizacion', soloPrimero: true },
	{ valor: 'esterilizacion_cuidados', nombre: 'Cuidados de la cirugía', pagina: '/esterilizacion', soloPrimero: false },
	{ valor: 'esterilizacion_preguntas', nombre: 'Preguntas frecuentes', pagina: '/esterilizacion', soloPrimero: false },
	{ valor: 'voluntariado', nombre: 'Voluntariado', pagina: '/donar', soloPrimero: true },
];
