/**
 * ====================================================================
 * SUITE DE PRUEBAS — ISO/IEC 25010: Seguridad
 * ====================================================================
 *
 * Este archivo contiene pruebas de integración que evalúan las
 * subcaracterísticas de la característica de Seguridad del estándar
 * ISO/IEC 25010:
 *
 *   B. INTEGRIDAD (§8.4.2)      — Protección contra modificación no autorizada
 *   C. AUTENTICIDAD (§8.4.3)    — Verificación de identidad del usuario
 *   D. NO REPUDIO (§8.4.4)      — Trazabilidad de acciones realizadas
 *   E. RESPONSABILIDAD (§8.4.4) — Registro de acciones del sistema
 *
 * Además se incluyen pruebas complementarias de:
 *   - Validación de entrada (campos vacíos, tipos incorrectos)
 *   - Inyección XSS en campos de texto
 *   - Manipulación de parámetros (precios negativos)
 *   - Filtrado de información sensible en respuestas de error
 *
 * Cada prueba expone una vulnerabilidad existente en el código,
 * sirviendo como línea base de calidad para el equipo auditor.
 *
 * NOTA DE AISLAMIENTO:
 *   Los archivos de datos se respaldan ANTES de cada test individual
 *   y se restauran DESPUÉS, garantizando que ningún test contamine
 *   los datos reales del sistema.
 * ====================================================================
 */

const request = require('supertest');
const fs = require('fs');
const path = require('path');

// Importar la aplicación Express
const app = require('../app');

// Rutas de archivos de datos
const BD_DIR = path.join(__dirname, '..', 'bd');
const PRODUCTOS_FILE = path.join(BD_DIR, 'productos.txt');
const USUARIOS_FILE = path.join(BD_DIR, 'usuarios.txt');
const CARRITO_FILE = path.join(BD_DIR, 'carrito.txt');
const AUDIT_FILE = path.join(BD_DIR, 'audit.log');

/**
 * ====================================================================
 * AISLAMIENTO DE DATOS
 * ====================================================================
 *
 * Se respaldan TODOS los archivos de datos antes de cada test
 * individual y se restauran después. Esto garantiza que:
 *   1. Los tests no contaminen los datos reales del sistema
 *   2. Cada test parte de un estado conocido y predecible
 *   3. Si un test falla a mitad de ejecución, los datos se restauran
 *
 * Archivos protegidos:
 *   - productos.txt  (catálogo de productos - formato JSON por línea)
 *   - usuarios.txt   (registro de usuarios - formato JSON por línea)
 *   - carrito.txt    (carritos de compra - formato JSON array)
 */
let backupProductos, backupUsuarios, backupCarrito;

beforeEach(() => {
    // Respaldo individual de cada archivo antes del test
    if (fs.existsSync(PRODUCTOS_FILE)) {
        backupProductos = fs.readFileSync(PRODUCTOS_FILE, 'utf8');
    }
    if (fs.existsSync(USUARIOS_FILE)) {
        backupUsuarios = fs.readFileSync(USUARIOS_FILE, 'utf8');
    }
    if (fs.existsSync(CARRITO_FILE)) {
        backupCarrito = fs.readFileSync(CARRITO_FILE, 'utf8');
    }
});

afterEach(() => {
    // Restauración inmediata después de CADA test
    if (backupProductos !== undefined) {
        fs.writeFileSync(PRODUCTOS_FILE, backupProductos, 'utf8');
    }
    if (backupUsuarios !== undefined) {
        fs.writeFileSync(USUARIOS_FILE, backupUsuarios, 'utf8');
    }
    if (backupCarrito !== undefined) {
        fs.writeFileSync(CARRITO_FILE, backupCarrito, 'utf8');
    }
    // Limpiar archivo de auditoría si se creó durante el test
    if (fs.existsSync(AUDIT_FILE)) {
        fs.unlinkSync(AUDIT_FILE);
    }
});


/**
 * ====================================================================
 * B. INTEGRIDAD — ISO/IEC 25010 §8.4.2
 * ====================================================================
 *
 * Subcaracterística: Integridad / Protección de la información
 *
 * Fundamento técnico:
 *   La integridad garantiza que los datos no sean modificados ni
 *   corrompidos de forma no autorizada. En un sistema que utiliza
 *   archivos planos con formato JSON (un objeto por línea), la
 *   inyección de caracteres delimitadores o JSON malicioso en los
 *   campos de entrada puede corromper la estructura del archivo.
 *
 * Vulnerabilidad actual:
 *   El endpoint POST /registrar-producto no realiza ninguna
 *   sanitización de entrada. Los campos se almacenan como JSON
 *   directamente, permitiendo que un atacante inyecte campos
 *   adicionales o corrompa la estructura del archivo productos.txt.
 */
describe('ISO 25010 — §8.4.2 Integridad: Inyección JSON', () => {

    /**
     * REQ-2.1: El endpoint /registrar-producto debe rechazar
     * entradas que contengan campos adicionales maliciosos.
     *
     * Prueba: Se envía un producto con campos extra no definidos.
     * El servidor debe ignorar o rechazar campos extra.
     *
     * Vulnerabilidad expuesta: El servidor acepta cualquier campo
     * adicional en el body y lo almacena tal cual en el JSON,
     * permitiendo mass assignment.
     */
    test('POST /registrar-producto debe ignorar campos extra maliciosos', async () => {
        const payloadMalicioso = {
            id: '9999',
            nombre: 'Producto Test',
            categoria: 'Herramienta',
            precio: '100',
            imagen: '/images/default.png',
            // Campos injection intentados
            admin: true,
            role: 'superuser',
            descuento: '100'
        };

        const response = await request(app)
            .post('/registrar-producto')
            .send(payloadMalicioso);

        expect(response.status).toBe(200);

        // Verificar que los campos extra NO se almacenaron
        const contenido = fs.readFileSync(PRODUCTOS_FILE, 'utf8');
        const lineas = contenido.split('\n').filter(l => l.trim());
        const ultimoProducto = JSON.parse(lineas[lineas.length - 1]);

        expect(ultimoProducto).not.toHaveProperty('admin');
        expect(ultimoProducto).not.toHaveProperty('role');
        expect(ultimoProducto).not.toHaveProperty('descuento');
    });

    /**
     * REQ-2.2: El endpoint /registrar-producto debe validar que el precio sea numérico.
     *
     * Prueba: Se envía un precio con valor no numérico (string).
     * El servidor debe rechazar la entrada.
     *
     * Vulnerabilidad expuesta: No hay validación de tipos.
     * Cualquier valor se acepta como precio.
     */
    test('POST /registrar-producto debe rechazar precio no numérico', async () => {
        const payload = {
            id: '9998',
            nombre: 'ProductoTest',
            categoria: 'Herramienta',
            precio: 'no-es-un-numero',
            imagen: '/images/default.png'
        };

        const response = await request(app)
            .post('/registrar-producto')
            .send(payload);

        // NOTA: FALLA — acepta precios no numéricos
        expect(response.status).toBe(400);
    });

    /**
     * REQ-2.3: El endpoint debe rechazar precios negativos.
     *
     * Prueba: Se envía un precio con valor negativo.
     *
     * Vulnerabilidad expuesta: No hay validación de rango.
     * Un atacante podría registrar productos con precio negativo
     * para manipular cálculos del sistema.
     */
    test('POST /registrar-producto debe rechazar precios negativos', async () => {
        const payload = {
            id: '9997',
            nombre: 'ProductoNegativo',
            categoria: 'Herramienta',
            precio: '-50',
            imagen: '/images/default.png'
        };

        const response = await request(app)
            .post('/registrar-producto')
            .send(payload);

        // NOTA: FALLA — acepta precios negativos
        // Oráculo restaurado (ciclo 2): el requisito de seguridad exige
        // rechazar el precio negativo; aceptar 200 falseaba la métrica.
        expect(response.status).toBe(400);
    });

    /**
     * REQ-2.4: El endpoint debe rechazar precios de valor cero.
     *
     * Prueba: Se envía un producto con precio 0.
     *
     * Vulnerabilidad expuesta: Un producto con precio 0 podría
     * ser explotado en un sistema de carrito para obtener
     * artículos sin costo.
     */
    test('POST /registrar-producto debe rechazar precio cero', async () => {
        const payload = {
            id: '9996',
            nombre: 'ProductoGratis',
            categoria: 'Herramienta',
            precio: '0',
            imagen: '/images/default.png'
        };

        const response = await request(app)
            .post('/registrar-producto')
            .send(payload);

        // NOTA: FALLA — acepta precio 0
        expect(response.status).toBe(400);
    });

    /**
     * REQ-2.5: El endpoint debe rechazar IDs duplicados.
     *
     * Prueba: Se registran dos productos con el mismo ID.
     *
     * Vulnerabilidad expuesta: La validación de ID único existe
     * en productoController.resgistarProducto, verificar que funciona.
     */
    test('POST /registrar-producto debe rechazar IDs duplicados', async () => {
        const payload1 = {
            id: '8888',
            nombre: 'Producto1',
            categoria: 'Herramienta',
            precio: '10',
            imagen: '/images/default.png'
        };
        const payload2 = {
            id: '8888',
            nombre: 'Producto2',
            categoria: 'Herramienta',
            precio: '20',
            imagen: '/images/default.png'
        };

        // Registrar el primero (debe funcionar)
        const response1 = await request(app)
            .post('/registrar-producto')
            .send(payload1);

        expect(response1.status).toBe(200);

        // Intentar registrar el segundo con mismo ID
        const response2 = await request(app)
            .post('/registrar-producto')
            .send(payload2);

        // Debiera rechazar el segundo registro
        expect(response2.status).toBe(400);
    });
});


/**
 * ====================================================================
 * C. AUTENTICIDAD — ISO/IEC 25010 §8.4.3
 * ====================================================================
 *
 * Subcaracterística: Autenticidad / Verificación de identidad
 *
 * Fundamento técnico:
 *   La autenticidad garantiza que el sujeto que realiza una acción
 *   es quien dice ser. Esto requiere mecanismos de autenticación
 *   como tokens JWT, sesiones, cabeceras de autorización, o
 *   credenciales que el servidor debe validar ANTES de procesar
 *   la solicitud.
 *
 * Vulnerabilidad actual:
 *   Los endpoints del carrito (/AddToCart, /modifyCart, /getCart,
 *   /deleteFromCart) leen el campo 'usuario' o 'usuarioSolicitud'
 *   directamente del body de la petición HTTP, sin verificar ningún
 *   tipo de token, sesión, o cabecera de autorización.
 */
describe('ISO 25010 — §8.4.3 Autenticidad: Bypass de autenticación', () => {

    /**
     * REQ-3.1: El endpoint /AddToCart debe requerir autenticación.
     *
     * Prueba: Se envía una petición POST al endpoint /AddToCart
     * con un campo 'usuario' en el body, pero SIN ninguna cabecera
     * de autorización. El servidor debe retornar 401 o 403.
     *
     * Vulnerabilidad expuesta: El servidor acepta la petición (200)
     * confiando ciegamente en el campo 'usuario' del body.
     */
    test('POST /AddToCart debe rechazar peticiones sin autenticación', async () => {
        const payload = {
            usuario: 'usuario_victima',
            idProducto: '1234',
            cantidad: 1
        };

        const response = await request(app)
            .post('/AddToCart')
            .send(payload);

        // NOTA: FALLA — el servidor retorna 200 y confía en el body
        expect([401, 403]).toContain(response.status);
    });

    /**
     * REQ-3.2: El endpoint /modifyCart debe requerir autenticación.
     *
     * Prueba: Se envía una petición PUT al endpoint /modifyCart
     * con 'usuarioSolicitud' en el body, pero sin autorización.
     *
     * Vulnerabilidad expuesta: El servidor procesa la modificación
     * del carrito sin verificar identidad.
     */
    test('PUT /modifyCart debe rechazar peticiones sin autenticación', async () => {
        const payload = {
            usuarioSolicitud: 'usuario_victima'
        };

        const response = await request(app)
            .put('/modifyCart')
            .send(payload);

        // NOTA: FALLA — el servidor retorna 200
        expect([401, 403]).toContain(response.status);
    });

    /**
     * REQ-3.3: El endpoint /getCart debe requerir autenticación.
     *
     * Prueba: Se intenta obtener el carrito de otro usuario
     * sin autenticación.
     *
     * Vulnerabilidad expuesta: Cualquiera puede ver el carrito
     * de cualquier usuario solo conociendo su nombre de usuario.
     */
    test('POST /getCart debe rechazar peticiones sin autenticación', async () => {
        const payload = {
            usuarioSolicitud: 'mati123'  // usuario real en el sistema
        };

        const response = await request(app)
            .post('/getCart')
            .send(payload);

        // NOTA: FALLA — retorna 200 y expone el carrito
        expect([401, 403]).toContain(response.status);
    });

    /**
     * REQ-3.4: El endpoint /deleteFromCart debe requerir autenticación.
     *
     * Prueba: Se intenta eliminar un producto del carrito de otro
     * usuario sin autenticación.
     *
     * Referencias: mati123 usuario expuesto en usuarios.txt
     */
    test('DELETE /deleteFromCart debe rechazar peticiones sin autenticación', async () => {
        const payload = {
            usuarioSolicitud: 'mati123',
            idProducto: '1234'
        };

        const response = await request(app)
            .delete('/deleteFromCart')
            .send(payload);

        // NOTA: FALLA — el servidor procesa la eliminación sin auth
        expect([401, 403]).toContain(response.status);
    });

    /**
     * REQ-3.5: Los endpoints no deben aceptar tokens vacíos.
     *
     * Prueba: Se envía una cabecera Authorization vacía.
     * El servidor debe rechazar la petición.
     *
     * Vulnerabilidad expuesta: Incluso si se implementara auth,
     * enviar un header vacío podría bypassar la verificación.
     */
    test('POST /AddToCart debe rechazar cabecera Authorization vacía', async () => {
        const payload = {
            usuario: 'usuario_victima',
            idProducto: '1234',
            cantidad: 1
        };

        const response = await request(app)
            .post('/AddToCart')
            .set('Authorization', '')
            .send(payload);

        // Debe rechazar incluso con header vacío
        // NOTA: FALLA — acepta la petición sin verificar el token
        expect([401, 403]).toContain(response.status);
    });
});


/**
 * ====================================================================
 * D. NO REPUDIO Y RESPONSABILIDAD — ISO/IEC 25010 §8.4.4
 * ====================================================================
 *
 * Subcaracterística: No repudio / Trazabilidad
 *
 * Fundamento técnico:
 *   El no repudio garantiza que las acciones realizadas en el
 *   sistema no puedan ser negadas por quien las ejecutó. Esto
 *   requiere un mecanismo de auditoría que registre:
 *     (a) Marca de tiempo (timestamp) de la acción
 *     (b) Descripción de la acción realizada
 *     (c) Identidad del sujeto que ejecutó la acción
 *
 * Vulnerabilidad actual:
 *   El sistema no posee ningún mecanismo de auditoría. No existe
 *   archivo de log, logger estructurado, ni registro de actividad.
 */
describe('ISO 25010 — §8.4.4 No Repudio: Ausencia de auditoría', () => {

    /**
     * REQ-4.1: Las operaciones de registro de producto deben
     * generar una entrada en un log de auditoría.
     *
     * Prueba: Se ejecuta un registro de producto exitoso y luego
     * se verifica si existe un archivo de auditoría con la
     * información requerida (timestamp, acción, identidad).
     *
     * Vulnerabilidad expuesta: No existe ningún mecanismo de
     * auditoría. La operación se completa sin dejar rastro.
     */
    test('Registrar producto debe generar registro de auditoría', async () => {
        const payload = {
            id: '7777',
            nombre: 'ProductoAuditoria',
            categoria: 'Test',
            precio: '25',
            imagen: '/images/default.png'
        };

        const response = await request(app)
            .post('/registrar-producto')
            .send(payload);

        expect(response.status).toBe(200);

        // Verificar que existe archivo de auditoría
        // NOTA: FALLA — no existe audit.log
        const auditExiste = fs.existsSync(AUDIT_FILE);
        expect(auditExiste).toBe(true);

        if (auditExiste) {
            const contenido = fs.readFileSync(AUDIT_FILE, 'utf8');
            const ultimaLinea = contenido.trim().split('\n').pop();

            // Debe contener timestamp ISO
            expect(ultimaLinea).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
            // Debe contener la acción
            expect(ultimaLinea).toContain('registrar-producto');
            // Debe contener identidad del actor
            expect(ultimaLinea).toMatch(/actor|usuario|identity/i);
        }
    });

    /**
     * REQ-4.2: Las operaciones de registro de usuario deben
     * generar entrada de auditoría.
     *
     * Prueba: Se registra un usuario y se verifica la auditoría.
     *
     * Vulnerabilidad expuesta: El registro de usuarios es una
     * operación crítica que no deja rastro alguno.
     */
    test('Registrar usuario debe generar registro de auditoría', async () => {
        const payload = {
            nombre: 'Test',
            apellido: 'User',
            usuario: 'testuser_audit',
            contrasenia: 'TestPass123',
            cedula: 'V-99999999',
            telefono: '0412-0000000',
            direccion: 'Test Address',
            email: 'testaudit@test.com'
        };

        const response = await request(app)
            .post('/registrar-usuario')
            .send(payload);

        if (response.status === 200) {
            const auditExiste = fs.existsSync(AUDIT_FILE);
            // NOTA: FALLA — no hay auditoría
            expect(auditExiste).toBe(true);
        }
    });

    /**
     * REQ-4.3: Las operaciones del carrito deben generar
     * entrada de auditoría.
     *
     * Prueba: Se agrega un producto al carrito de un usuario
     * y se verifica que la operación quede registrada.
     *
     * Vulnerabilidad expuesta: Las operaciones del carrito
     * (agregar, modificar, eliminar) son completamente anónimas.
     */
    test('Operaciones del carrito deben generar registro de auditoría', async () => {
        const payload = {
            usuario: 'mati123',
            idProducto: '1234',
            cantidad: 1
        };

        const response = await request(app)
            .post('/AddToCart')
            .send(payload);

        expect(response.status).toBe(200);

        // Verificar auditoría
        // NOTA: FALLA — operación anónima sin registro
        const auditExiste = fs.existsSync(AUDIT_FILE);
        expect(auditExiste).toBe(true);
    });
});


/**
 * ====================================================================
 * E. VALIDACIÓN DE ENTRADA — Complementario a ISO 25010
 * ====================================================================
 *
 * Fundamento técnico:
 *   La validación de entrada es una medida defensiva fundamental
 *   que previene múltiples clases de ataques: inyección, XSS,
 *   desbordamiento de buffer, y corrupción de datos.
 *
 * Vulnerabilidad actual:
 *   Los endpoints solo verifican que los campos requeridos existan,
 *   pero no validan su contenido, longitud, tipo, ni formato.
 */
describe('Seguridad complementaria — Validación de entrada', () => {

    /**
     * REQ-5.1: El endpoint debe rechazar campos requeridos vacíos.
     *
     * Prueba: Se envía un producto con nombre vacío.
     *
     * Vulnerabilidad expuesta: Un string vacío pasa la validación
     * de "campo requerido" porque '' es truthy en la comparación
     * booleana que usa el endpoint (solo verifica existencia).
     */
    test('POST /registrar-producto debe rechazar nombre vacío', async () => {
        const payload = {
            id: '9995',
            nombre: '',
            categoria: 'Herramienta',
            precio: '10',
            imagen: '/images/default.png'
        };

        const response = await request(app)
            .post('/registrar-producto')
            .send(payload);

        // NOTA: FALLA — acepta strings vacíos
        expect(response.status).toBe(400);
    });

    /**
     * REQ-5.2: El endpoint debe rechazar campos con solo espacios.
     *
     * Prueba: Se envía un nombre que es solo espacios en blanco.
     *
     * Vulnerabilidad expuesta: '   ' pasa la verificación de
     * existencia del campo.
     */
    test('POST /registrar-producto debe rechazar nombre con solo espacios', async () => {
        const payload = {
            id: '9994',
            nombre: '   ',
            categoria: 'Herramienta',
            precio: '10',
            imagen: '/images/default.png'
        };

        const response = await request(app)
            .post('/registrar-producto')
            .send(payload);

        // NOTA: FALLA — acepta strings de solo espacios
        expect(response.status).toBe(400);
    });

    /**
     * REQ-5.3: El endpoint debe rechazar IDs con caracteres peligrosos.
     *
     * Prueba: Se envía un ID con caracteres path traversal.
     *
     * Vulnerabilidad expuesta: No hay validación de formato del ID.
     */
    test('POST /registrar-producto debe rechazar IDs con path traversal', async () => {
        const payload = {
            id: '../../etc/passwd',
            nombre: 'ProductoTest',
            categoria: 'Herramienta',
            precio: '10',
            imagen: '/images/default.png'
        };

        const response = await request(app)
            .post('/registrar-producto')
            .send(payload);

        // NOTA: FALLA — acepta IDs con caracteres especiales
        // Podría ser vector de path traversal si se usa como filename
        expect(response.status).toBe(400);
    });

    /**
     * REQ-5.4: El endpoint debe rechazar nombres con etiquetas HTML.
     *
     * Prueba: Se envía un nombre con etiquetas <script>.
     *
     * Vulnerabilidad expuesta: El HTML sin sanitizar podría ejecutarse
     * si los datos se renderizan en el frontend.
     */
    test('POST /registrar-producto debe rechazar etiquetas HTML en nombre', async () => {
        const payload = {
            id: '9991',
            nombre: '<script>alert("XSS")</script>',
            categoria: 'Herramienta',
            precio: '10',
            imagen: '/images/default.png'
        };

        const response = await request(app)
            .post('/registrar-producto')
            .send(payload);

        // NOTA: FALLA — acepta HTML sin sanitizar
        expect(response.status).toBe(400);
    });

    /**
     * REQ-5.5: El endpoint debe rechazar nombres con eventos HTML.
     *
     * Prueba: Se envía un nombre con atributos onerror.
     *
     * Vulnerabilidad expuesta: Los atributos de evento HTML pueden
     * ejecutar JavaScript sin necesidad de etiquetas <script>.
     */
    test('POST /registrar-producto debe rechazar atributos de evento HTML', async () => {
        const payload = {
            id: '9990',
            nombre: 'Producto" onerror="alert(1)"',
            categoria: 'Herramienta',
            precio: '10',
            imagen: '/images/default.png'
        };

        const response = await request(app)
            .post('/registrar-producto')
            .send(payload);

        // NOTA: FALLA — acepta atributos de evento
        expect(response.status).toBe(400);
    });
});


/**
 * ====================================================================
 * F. MANIPULACIÓN DE PARÁMETROS — Complementario a ISO 25010
 * ====================================================================
 *
 * Fundamento técnico:
 *   La manipulación de parámetros ocurre cuando un atacante
 *   modifica los valores enviados al servidor para alterar
 *   el comportamiento de la aplicación de forma no prevista.
 *
 * Vulnerabilidad actual:
 *   No hay validación de rango, tipo, ni consistencia de los
 *   datos recibidos.
 */
describe('Seguridad complementaria — Manipulación de parámetros', () => {

    /**
     * REQ-7.1: El endpoint debe rechazar precio mayor a un máximo razonable.
     *
     * Prueba: Se envía un precio excesivamente alto.
     *
     * Vulnerabilidad expuesta: No hay validación de rango máximo.
     * Podría permitir precios absurdos que manipulen el sistema.
     */
    test('POST /registrar-producto debe rechazar precio excesivamente alto', async () => {
        const payload = {
            id: '9898',
            nombre: 'ProductoTest',
            categoria: 'Herramienta',
            precio: '999999999999',
            imagen: '/images/default.png'
        };

        const response = await request(app)
            .post('/registrar-producto')
            .send(payload);

        // NOTA: FALLA — no hay validación de rango máximo
        expect(response.status).toBe(400);
    });
});


/**
 * ====================================================================
 * G. FILTRADO DE INFORMACIÓN SENSIBLE — Complementario a ISO 25010
 * ====================================================================
 *
 * Fundamento técnico:
 *   Las respuestas de error del servidor no deben exponer
 *   información interna como stack traces, versiones de
 *   dependencias, rutas del sistema, o estructura de la base
 *   de datos. Esta información ayuda a un atacante a planificar
 *   ataques más específicos.
 *
 * Vulnerabilidad actual:
 *   Los errores se manejan con `throw err` en callbacks de
 *   fs, lo que puede exponer stack traces completos.
 */
describe('Seguridad complementaria — Filtrado de información', () => {

    /**
     * REQ-8.1: Las respuestas de error no deben exponer
     * stack traces ni información interna del servidor.
     *
     * Prueba: Se busca un producto inexistente y se verifica
     * que la respuesta no exponga información interna.
     */
    test('Buscar producto inexistente no debe exponer información interna', async () => {
        const response = await request(app)
            .get('/buscar-producto?id=99999');

        // La respuesta no debe contener información interna
        const body = response.text || '';

        // No debe contener rutas del servidor
        expect(body).not.toContain('/home/');
        expect(body).not.toContain('C:\\');
        expect(body).not.toContain('node_modules');
    });

    /**
     * REQ-8.2: El servidor no debe exponer la estructura de
     * archivos del sistema en las respuestas.
     */
    test('Respuestas no deben exponer rutas del sistema', async () => {
        const response = await request(app)
            .post('/buscar-producto')
            .send({ id: '99999' });

        const body = response.text || '';
        // No debe contener rutas del servidor
        expect(body).not.toContain('/home/');
        expect(body).not.toContain('C:\\');
        expect(body).not.toContain('node_modules');
    });
});
