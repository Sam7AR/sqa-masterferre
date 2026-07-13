/**
 * ====================================================================
 * SUITE ADICIONAL — ISO/IEC 25010: Seguridad (Fase 2, ciclo formal)
 * ====================================================================
 *
 * Casos que cierran las brechas señaladas en la inspección estática
 * y no cubiertas por app.test.js:
 *
 *   H. CONCURRENCIA (KAN-58 / IC-02)   — Integridad §8.4.2:
 *      escrituras simultáneas sobre bd/*.txt sin exclusión mutua.
 *   I. AUTORIZACIÓN POR PROPIEDAD (KAN-59, KAN-60 / IC-03, IC-04):
 *      un usuario no debe poder operar sobre recursos de otro.
 *   J. ERROR REAL DE PERSISTENCIA (KAN-62 / IC-06)  — §8.4.1:
 *      ante archivo corrupto/inaccesible la respuesta debe ser un
 *      error genérico controlado, sin caída ni información interna.
 *
 * Cada caso conserva el oráculo del requisito de seguridad: si el
 * producto no implementa el control, el caso DEBE fallar. Ese fallo
 * es el hallazgo, no un defecto de la prueba.
 *
 * NOTA DE AISLAMIENTO: mismo patrón de respaldo/restauración por
 * test que app.test.js. Los casos de corrupción restauran el archivo
 * en afterEach, por lo que no contaminan los datos reales.
 * ====================================================================
 */

const request = require('supertest');
const fs = require('fs');
const path = require('path');

const app = require('../app');

const BD_DIR = path.join(__dirname, '..', 'bd');
const PRODUCTOS_FILE = path.join(BD_DIR, 'productos.txt');
const USUARIOS_FILE = path.join(BD_DIR, 'usuarios.txt');
const CARRITO_FILE = path.join(BD_DIR, 'carrito.txt');
const AUDIT_FILE = path.join(BD_DIR, 'audit.log');

// registrarProducto responde ANTES de completar appendFile: hay que
// dar tiempo a que las escrituras pendientes terminen antes de leer
// el archivo o restaurarlo (riesgo de carrera documentado en el PACS).
const esperar = (ms) => new Promise(resolve => setTimeout(resolve, ms));

let backupProductos, backupUsuarios, backupCarrito;

beforeEach(() => {
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

afterEach(async () => {
    // Esperar escrituras asíncronas pendientes antes de restaurar
    await esperar(300);
    if (backupProductos !== undefined) {
        fs.writeFileSync(PRODUCTOS_FILE, backupProductos, 'utf8');
    }
    if (backupUsuarios !== undefined) {
        fs.writeFileSync(USUARIOS_FILE, backupUsuarios, 'utf8');
    }
    if (backupCarrito !== undefined) {
        fs.writeFileSync(CARRITO_FILE, backupCarrito, 'utf8');
    }
    if (fs.existsSync(AUDIT_FILE)) {
        fs.unlinkSync(AUDIT_FILE);
    }
});


/**
 * ====================================================================
 * H. CONCURRENCIA — ISO/IEC 25010 §8.4.2 (KAN-58 / IC-02)
 * ====================================================================
 *
 * Fundamento técnico:
 *   La persistencia usa lectura + appendFile/writeFile sin ningún
 *   mecanismo de exclusión mutua. La validación de ID duplicado lee
 *   el archivo ANTES de escribir, de modo que dos solicitudes
 *   simultáneas con el mismo ID pueden pasar ambas la validación.
 */
describe('ISO 25010 — §8.4.2 Integridad: Concurrencia sin exclusión mutua', () => {

    /**
     * REQ-6.1: Dos registros simultáneos con el MISMO ID deben
     * producir exactamente un éxito y un rechazo (400).
     *
     * Vulnerabilidad esperada: ambas solicitudes leen el archivo antes
     * de que la otra escriba, ambas responden 200 y el ID queda
     * duplicado (condición de carrera TOCTOU).
     */
    test('Registros concurrentes con el mismo ID deben rechazar el duplicado', async () => {
        const base = {
            nombre: 'ProductoConcurrente',
            categoria: 'Herramienta',
            precio: '10',
            imagen: '/images/default.png'
        };

        const [r1, r2] = await Promise.all([
            request(app).post('/registrar-producto').send({ ...base, id: '5555' }),
            request(app).post('/registrar-producto').send({ ...base, id: '5555' })
        ]);

        await esperar(400); // dejar terminar los appendFile pendientes

        const rechazadas = [r1.status, r2.status].filter(s => s === 400).length;

        // NOTA: FALLA ESPERADA — sin lock, ninguna solicitud es rechazada
        expect(rechazadas).toBe(1);

        // El archivo no debe contener el ID duplicado
        const contenido = fs.readFileSync(PRODUCTOS_FILE, 'utf8');
        const ocurrencias = contenido.split('\n').filter(l => l.includes('"id":"5555"')).length;
        expect(ocurrencias).toBeLessThanOrEqual(1);
    });

    /**
     * REQ-6.2: N escrituras concurrentes con IDs distintos no deben
     * corromper la estructura JSON-por-línea del archivo ni perder
     * registros.
     */
    test('Escrituras concurrentes no deben corromper ni perder registros', async () => {
        const ids = ['6001', '6002', '6003', '6004', '6005', '6006', '6007', '6008'];

        await Promise.all(ids.map(id =>
            request(app).post('/registrar-producto').send({
                id,
                nombre: `ProductoParalelo${id}`,
                categoria: 'Herramienta',
                precio: '15',
                imagen: '/images/default.png'
            })
        ));

        await esperar(500); // los appendFile ocurren después de las respuestas

        const contenido = fs.readFileSync(PRODUCTOS_FILE, 'utf8');
        const lineas = contenido.split('\n').filter(l => l.trim() !== '');

        // Toda línea debe seguir siendo JSON válido (sin entrelazado)
        for (const linea of lineas) {
            expect(() => JSON.parse(linea)).not.toThrow();
        }

        // Ningún registro debe perderse
        for (const id of ids) {
            const presentes = lineas.filter(l => l.includes(`"id":"${id}"`)).length;
            expect(presentes).toBe(1);
        }
    });

    /**
     * REQ-6.3: Una modificación (lectura + writeFile completo) que se
     * cruza con un registro (appendFile) no debe perder el registro.
     *
     * Vulnerabilidad esperada: modificarProducto reescribe el archivo
     * completo a partir de una lectura previa; el producto añadido en
     * paralelo puede desaparecer (lost update).
     */
    test('Modificación y registro concurrentes no deben perder datos', async () => {
        // Producto pre-existente que se va a modificar
        await request(app).post('/registrar-producto').send({
            id: '6100',
            nombre: 'ProductoBase',
            categoria: 'Herramienta',
            precio: '30',
            imagen: '/images/default.png'
        });
        await esperar(300);

        await Promise.all([
            request(app).put('/buscar-producto/?id=6100').send({
                id: '6100',
                nombre: 'ProductoBaseModificado',
                categoria: 'Herramienta',
                precio: '35',
                imagen: '/images/default.png'
            }),
            request(app).post('/registrar-producto').send({
                id: '6200',
                nombre: 'ProductoSimultaneo',
                categoria: 'Herramienta',
                precio: '40',
                imagen: '/images/default.png'
            })
        ]);

        await esperar(500);

        const contenido = fs.readFileSync(PRODUCTOS_FILE, 'utf8');
        // NOTA: FALLA POSIBLE/NO DETERMINISTA — writeFile puede pisar el append
        expect(contenido).toContain('"id":"6200"');
        expect(contenido).toContain('ProductoBaseModificado');
    });
});


/**
 * ====================================================================
 * I. AUTORIZACIÓN POR PROPIEDAD — §8.4.3/§8.4.2 (KAN-59, KAN-60)
 * ====================================================================
 *
 * Fundamento técnico:
 *   Aunque existiera autenticación, el servidor debe verificar que el
 *   solicitante es dueño del recurso. Hoy la identidad viaja en el
 *   body (usuarioSolicitud) sin sesión ni token, por lo que cualquier
 *   usuario puede leer o vaciar el carrito de otro.
 */
describe('ISO 25010 — §8.4.3 Autorización por propiedad del recurso', () => {

    /**
     * REQ-9.1: Un usuario no debe poder LEER el carrito de otro
     * usuario haciéndose pasar por él en el body.
     */
    test('Usuario B no debe poder leer el carrito del usuario A', async () => {
        // A (mati123, usuario real del sistema) tiene o crea carrito
        await request(app).post('/AddToCart').send({
            usuario: 'mati123',
            idProducto: '1234',
            cantidad: 1
        });
        await esperar(300);

        // B intenta leer el carrito de A: solo conoce su nombre de usuario.
        // Sin credenciales de A, el servidor debe negar el acceso.
        const respuesta = await request(app).post('/getCart').send({
            usuarioSolicitud: 'mati123'
        });

        // NOTA: FALLA ESPERADA — retorna 200 con el carrito de A
        expect([401, 403]).toContain(respuesta.status);
    });

    /**
     * REQ-9.2: Un usuario no debe poder MODIFICAR (vaciar/alterar) el
     * carrito de otro usuario suplantando el campo usuarioSolicitud.
     */
    test('Usuario B no debe poder modificar el carrito del usuario A', async () => {
        await request(app).post('/AddToCart').send({
            usuario: 'mati123',
            idProducto: '1234',
            cantidad: 2
        });
        await esperar(300);

        const respuesta = await request(app).put('/modifyCart').send({
            usuarioSolicitud: 'mati123',
            idProducto: '1234',
            cantidad: 99
        });

        // NOTA: FALLA ESPERADA — la modificación se procesa sin verificar identidad
        expect([401, 403]).toContain(respuesta.status);
    });
});


/**
 * ====================================================================
 * J. ERROR REAL DE PERSISTENCIA — §8.4.1 (KAN-62 / IC-06)
 * ====================================================================
 *
 * Fundamento técnico:
 *   Los casos de filtrado existentes (REQ-8.x) no fuerzan un error
 *   real de filesystem. Aquí se corrompe o retira el archivo de
 *   datos para ejercer las rutas de error verdaderas y verificar que
 *   la respuesta sea 5xx genérica, sin rutas internas ni stack trace.
 */
describe('ISO 25010 — §8.4.1 Confidencialidad: Error real de persistencia', () => {

    /**
     * REQ-10.1: Con el almacén de datos corrupto (línea no-JSON), la
     * búsqueda debe responder un error controlado (5xx) y no un 200
     * silencioso ni una caída.
     *
     * Nota: buscarProducto captura la excepción con console.error y
     * devuelve null, de modo que el cliente recibe 200/null y nunca
     * sabe que el almacén está dañado (falla silenciosa).
     */
    test('Almacén corrupto: buscar producto debe responder error controlado 5xx', async () => {
        fs.writeFileSync(PRODUCTOS_FILE, 'ESTO-NO-ES-JSON{{{\n', 'utf8');

        const respuesta = await request(app).get('/buscar-producto?id=1234');

        // No debe exponer información interna
        const body = respuesta.text || '';
        expect(body).not.toContain('C:\\');
        expect(body).not.toContain('/home/');
        expect(body).not.toContain('node_modules');
        expect(body).not.toMatch(/at .+\(.+:\d+:\d+\)/); // stack trace

        // NOTA: FALLA ESPERADA — responde 200 con null (falla silenciosa),
        // el requisito exige señalizar el error de forma genérica.
        expect(respuesta.status).toBeGreaterThanOrEqual(500);
    });

    /**
     * REQ-10.2: Con el almacén de datos AUSENTE, la modificación debe
     * responder 500 genérico sin exponer la ruta del archivo.
     *
     * Nota: modificarProducto sí maneja err de lectura con un mensaje
     * genérico; este caso documenta el comportamiento correcto que el
     * resto de controladores (throw err) no tiene.
     */
    test('Almacén ausente: modificar producto debe responder 500 genérico sin rutas', async () => {
        fs.unlinkSync(PRODUCTOS_FILE);

        const respuesta = await request(app).put('/buscar-producto/?id=1234').send({
            id: '1234',
            nombre: 'Cualquiera',
            categoria: 'Herramienta',
            precio: '10',
            imagen: '/images/default.png'
        });

        expect(respuesta.status).toBe(500);
        const body = respuesta.text || '';
        expect(body).not.toContain('C:\\');
        expect(body).not.toContain('/home/');
        expect(body).not.toContain('bd');
        expect(body).not.toContain(path.sep + 'productos.txt');
    });
});
