const express = require('express');
const app = express();
const path = require('node:path');
const fs = require('node:fs');
const Producto = require('./model/Producto');
const Cliente = require('./model/Cliente');
const Empleado = require('./model/Empleado');
const Catalogo = require('./model/Catalogo');
const e = require('express');
const upload = require('./model/libs/upload');
const productoController = require('./controller/productoController');
const catalogoController = require('./controller/catalogoController');
const usuarioController = require('./controller/usuarioController');
const carritoController = require('./controller/carritoController');
app.use(express.static('public'));
app.use(express.static('files'));
app.use(express.static('pages'));
app.use(express.static('classes'));
app.use(express.static('scripts'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//Respuestas del servidor cuando se entra por primera vez
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname + '/view/main.html'));
});

//Respuesta del servidor al entrar a una pagina y querer volver al main
app.get('/main', (req, res) => {
    res.sendFile(path.join(__dirname + '/view/main.html'));
});

app.put('/main', (req, res) => {
    try {
        catalogoController.modificarProductoCatalogo(req, res);
    } catch (error) {
        console.error("Error al modificar producto:", error);
        res.status(500).send("Error interno del servidor");
    }
});

app.delete('/main', async (req, res) => {
    await catalogoController.eliminarProductoCatalogo(req.body.id);
});

//Respuesta del servidor ante solicitud de ir a pagina registrar producto
app.get('/registrar-productos', (req, res) => {
    res.sendFile(path.join(__dirname + '/view/registrar-producto.html'));
});


//Respuesta del servidor ante solicitud de ir a pagina buscar producto
app.get('/buscar-producto', async (req, res) => {
    const id = req.query.id;
    if (id) {
        try {
            let producto = await productoController.buscarProducto(id); //falta vlidar que no encuentre el producto
            res.json(producto);
        } catch (error) {
            console.error("Error al buscar producto:", error);
            res.status(500).send("Error interno del servidor");
        }
    } else {
        res.sendFile(path.join(__dirname + '/view/buscar-producto.html'));
    }
});

app.put('/buscar-producto/', async (req, res) => {
    const id = req.query.id;
    if (id) {
        try {
            productoController.modificarProducto(req, res);
        } catch (error) {
            console.error("Error al modificar producto:", error);
            res.status(500).send("Error interno del servidor");
        }
    }
});

app.delete('/buscar-producto/', async (req, res) => {
    const id = req.query.id;
    if (id) {
        try {
            let found = await productoController.eliminarProducto(id);
            if (found) {
                res.status(200).send("Producto eliminado con exito");
            }
            else {
                res.status(404).send("Producto no encontrado");
            }
        } catch (error) {
            console.error("Error al eliminar producto:", error);
            res.status(500).send("Error interno del servidor");
        }
    }
});

app.get('/registrar-usuario', (req, res) => {
    res.sendFile(path.join(__dirname + '/view/registrar-usuario.html'));
});

app.get('/buscar-usuario', async (req, res) => {
    const cedula = req.query.cedula;
    if (cedula) {
        try {
            let usuario = await usuarioController.buscarUsuario(cedula);
            res.json(usuario);
        } catch (error) {
            console.error("Error al buscar usuario:", error);
            res.status(500).send("Error interno del servidor");
        }
    } else {
        res.sendFile(path.join(__dirname + '/view/buscar-usuario.html'));
    }
});

app.put('/buscar-usuario', async (req, res) => {
    try {
        await usuarioController.modificarUsuario(req, res);
    } catch (error) {
        console.error("Error al buscar usuario:", error);
        res.status(500).send("Error interno del servidor");
    }
});

app.delete('/buscar-usuario', async (req, res) => {
    const cedula = req.query.cedula;
    if (cedula) {
        try {
            await usuarioController.eliminarUsuario(cedula);
            res.status(200).send("Usuario eliminado con exito");
        } catch (error) {
            console.error("Error al buscar usuario:", error);
            res.status(500).send("Error interno del servidor");
        }
    }
});


//Respuesta del servidor ante solicitud de ir a pagina de registrar producto en catalogo
app.get('/registrar-producto-catalogo', (req, res) => {
    res.sendFile(path.join(__dirname + '/view/registrar-producto-catalogo.html'));
});

//Respuesta del servidor ante solicitud de ir a pagina de carrito
app.get('/carrito', (req, res) => {
    res.sendFile(path.join(__dirname + '/view/carrito.html'));
});

//Respuestas del servidor al ejecutar acciones de tipo CRUD en distintas paginas

//para registrar productos en la pagina registrar productos (entregable producto)
app.post('/registrar-producto', upload.single("imagen"), productoController.resgistrarProducto);

//para buscar productos en la pagina buscar productos (entregable producto, se buscan por su id)
app.get('/productos', productoController.mostrarProducto)

//para buscar productos y registrarlos en el catalogo si existen (entregable catalogo, se buscan por su id)
app.post('/registrar-producto-catalogo', (req, res) => {
    catalogoController.resgistrarProductoCatalogo(req, res)
});

//para mostrar productos en catalogo (entregable catalogo)
app.get('/catalogo', catalogoController.mostrarProductoCatalogo);

//para registrar usuarios en la pagina registrar usuario (entregable usuario)
app.post('/registrar-usuario', usuarioController.registrarUsuario);

//Agregar producto al carrito
app.post('/AddToCart', carritoController.agregarProductoCarrito);

//Mostrar carrito
app.post('/getCart', carritoController.mostrarCarrito)

//Modificar Carrito recibo en el body un usuarioSolicitud
app.put('/modifyCart', carritoController.modificarCarrito)

//Eliminar producto del carrito
app.delete('/deleteFromCart', carritoController.eliminarProductoCarrito)

//Solicitar compra
app.get('/compras', (req, res) => {
    res.sendFile(path.join(__dirname + '/view/compras.html'))
});

// necesito un usuarioSolicitud en el body
app.put('/solicitarCompra', carritoController.solicitarCompra)

//confirmarCompra
// necesito un idCompra en el body
app.put('/confirmarCompra', carritoController.confirmarCompra)

//consultarCompra
app.get('/consultarCompra/:idCompra', carritoController.consultarCompra)

//solicitar compras usuario
app.get('/consultarComprasUsuario/:usuarioSolicitud', carritoController.solicitarComprasUsuario)

//eliminar compra
app.delete('/eliminarCompra/:idCompra', carritoController.eliminarCompra)

app.listen(3000, () => {
    console.log('Servidor escuchando en el puerto http://localhost:3000');
});