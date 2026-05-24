/**
 * ====================================================================
 * SUITE DE PRUEBAS — ISO/IEC 25010: Seguridad
 * ====================================================================
 *
 * Subcaracterística evaluada: CONFIDENCIALIDAD (§8.4.1)
 *
 * Fundamento técnico:
 *   La norma ISO/IEC 25010 establece que un sistema debe proteger
 *   la información para que solo personas autorizadas puedan acceder.
 *   Esto incluye no exponer datos sensibles como contraseñas en
 *   representaciones serializadas del objeto (toString(), logs, etc.).
 *
 * Vulnerabilidad actual:
 *   El método Cliente.toString() incluye la contraseña en texto plano
 *   en su salida. Esto significa que al guardar el usuario en
 *   usuarios.txt, la contraseña queda expuesta en disco sin ningún
 *   tipo de protección (hashing, enmascaramiento, o cifrado).
 *
 * Resultado esperado del test: FALLA (la vulnerabilidad existe)
 * ====================================================================
 */

const Cliente = require('../classes/Cliente');

describe('ISO 25010 — §8.4.1 Confidencialidad', () => {

    /**
     * REQ-1.1: El método toString() de Cliente NO debe exponer
     * la contraseña en texto plano.
     *
     * Justificación: Según ISO 25010 §8.4.1 (Confidencialidad),
     * los datos de autenticación deben estar protegidos contra
     * acceso no autorizado. Almacenar contraseñas en texto plano
     * viola este principio fundamental de seguridad.
     *
     * Vulnerabilidad expuesta: toString() incluye this.contrasenia
     * directamente en la cadena resultante, lo que permite que
     * cualquier persona con acceso al archivo usuarios.txt o a
     * los logs del servidor obtenga las credenciales de los usuarios.
     */
    test('toString() NO debe contener la contraseña en texto plano', () => {
        // Arrange: crear un cliente con una contraseña conocida
        const PASSWORD_SECRETO = 'MiPassword123!';
        const cliente = new Cliente(
            'Juan', 'Pérez', 'jperez',
            PASSWORD_SECRETO,
            'V-12345678', 'Calle Principal', '0412-1234567',
            'jperez@email.com'
        );

        // Act: obtener la representación en string
        const resultado = cliente.toString();

        // Assert: la contraseña NO debe aparecer en la salida
        // NOTA: Este test FALLA porque toString() actualmente
        // expone la contraseña — esto documenta la vulnerabilidad
        expect(resultado).not.toContain(PASSWORD_SECRETO);
    });

    /**
     * Test adicional: verificar que toString() no contenga
     * ningún patrón que sugiera exposición de credenciales.
     */
    test('toString() no debe incluir el campo contraseña con su valor', () => {
        const cliente = new Cliente(
            'María', 'García', 'mgarcia',
            'SecretaPass456!',
            'V-87654321', 'Avenida Bolívar', '0414-7654321',
            'mgarcia@email.com'
        );

        const resultado = cliente.toString();

        // La salida no debe contener la contraseña como substring
        expect(resultado).not.toContain('SecretaPass456!');
        // Tampoco debe contener un patrón como "contrasenia, SecretaPass456!"
        expect(resultado).not.toMatch(/contrasenia.*SecretaPass456!/i);
    });
});
