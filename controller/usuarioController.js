const fs = require('fs');
const path = require('node:path');
const Cliente = require('../model/Cliente');

function registrarUsuario(req, res) {
    if (!req.body.usuario || !req.body.contrasenia || !req.body.cedula || !req.body.telefono || !req.body.direccion) {
        return res.status(400).send('Todos los campos son requeridos, intente de nuevo');
    }
    const newUser = JSON.parse(JSON.stringify(req.body));

    fs.readFile(path.join(__dirname, '..','bd','usuarios.txt'), 'utf8', (err, data) => {
        if (err) throw err;

        const lines = data.split('\n');
        for (let line of lines) {
            if(line !== ""){
                let u = JSON.parse(line);
                if (u.email === newUser.email)
                    return res.status(400).send('Error, el correo ingresado ya ha sido registrado.\nIntentelo de nuevo');
                else if (u.usuario === newUser.usuario)
                    return res.status(400).send('Error, el usuario ingresado ya existe.\nIntentelo de nuevo');
                else if (u.cedula === newUser.cedula)
                    return res.status(400).send('Error, la cedula ingresada ya existe.\nIntentelo de nuevo');
                else if (u.telefono === newUser.telefono)
                    return res.status(400).send('Error, el telefono ingresado ya ha sido registrado.\nIntentelo de nuevo');
            }
        }
        // Si llegamos aquí, el usuario no existe, así que agregamos el nuevo usuario
        fs.appendFile(path.join(__dirname, '..','bd','usuarios.txt'), JSON.stringify(newUser)+'\n', (err) => {
            if (err) throw err;
            res.status(200).send('Usuario registrado con éxito');
        });
    });
}

function leerArchivoComoPromesa(rutaArchivo) {
    return new Promise((resolve, reject) => {
        fs.readFile(rutaArchivo, 'utf8', (err, data) => {
            if (err) reject(err);
            else resolve(data);
        });
    });
}

async function buscarUsuario(cedulaBuscada) {
    let usuario = null;
    try {
        const data = await leerArchivoComoPromesa(path.join(__dirname, '..', 'bd', 'usuarios.txt'));
        let lineas = data.split('\n');

        lineas.forEach(linea => {
            if(linea!==""){
                let u = JSON.parse(linea);
                if (u.cedula === cedulaBuscada) {
                    usuario = u
                }
            }
        });
    } catch (err) {
        console.error("Error al leer el archivo: ", err);
    }    
    return usuario;
}

async function modificarUsuario(req,res) {
    let datosActualizados = req.body;
    fs.readFile(path.join(__dirname, '..', 'bd', 'usuarios.txt'), 'utf8', (err, data) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Error al leer el archivo de productos');
        }

        let usuarioModificado = false;
        let lineas = data.split('\n');
        let usuarios = lineas.map(linea => {
            if (linea !== "") {
                let u = JSON.parse(linea);            
                if (u.cedula === datosActualizados.cedula) {
                    usuarioModificado = true;
                    return new Cliente(datosActualizados.nombre, datosActualizados.apellido, datosActualizados.usuario, datosActualizados.contrasenia, datosActualizados.cedula, datosActualizados.direccion, datosActualizados.telefono, datosActualizados.email);
                }
                return new Cliente(u.nombre, u.apellido, u.usuario, u.contrasenia, u.cedula, u.direccion, u.telefono, u.email);
            }
        }).filter(Boolean);

        if (!usuarioModificado) {
            return res.status(404).send('Usuario no encontrado');
        }

        const nuevoContenido = usuarios.map(u => JSON.stringify(u)).join('\n')+'\n';

        fs.writeFile(path.join(__dirname, '..', 'bd', 'usuarios.txt'), nuevoContenido, 'utf8', (err) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Error al escribir en el archivo de usuarios');
            }
            res.send('Usuario modificado con éxito');
        });
    });
}

async function eliminarUsuario(cedulaBuscada) {
    try {
        fs.readFile(path.join(__dirname, '..', 'bd', 'usuarios.txt'), 'utf8', (err, data) => {
            if (err) throw err;
            let lineas = data.split('\n');            
            let nuevaData = lineas.filter(linea => {
                if(linea!==""){
                    let usuario = JSON.parse(linea);
                    return usuario.cedula !== cedulaBuscada;
                }
            }).join('\n');
            fs.writeFile(path.join(__dirname, '..', 'bd', 'usuarios.txt'), nuevaData, (err) => {
                if (err) throw err;
            });
        });
    } catch (err) {
        console.error("Error al modificar el archivo: ", err);
    }
}

module.exports = {
    registrarUsuario,
    buscarUsuario,
    modificarUsuario,
    eliminarUsuario
};