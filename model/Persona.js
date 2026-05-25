module.exports = class Persona {
    constructor(nombre, apellido, usuario, contrasenia, cedula, direccion, telefono, condicion) {
        this.nombre = nombre
        this.apellido = apellido
        this.usuario = usuario
        this.contrasenia = contrasenia
        this.cedula = cedula
        this.direccion = direccion
        this.telefono = telefono
        this.condicion = condicion      
    }

    getnombre() {
        return this.nombre;
    }

    setnombre(value) {
        this.nombre = value;
    }

    getapellido() {
        return this.apellido;
    }

    setapellido(value) {
        this.apellido = value;
    }

    getusuario() {
        return this.usuario;
    }

    setusuario(value) {
        this.usuario = value;
    }

    getcontrasenia() {
        return this.contrasenia;
    }

    setcontrasenia(value) {
        this.contrasenia = value;
    }

    getcedula() {
        return this.cedula;
    }

    setcedula(value) {
        this.cedula = value;
    }

    getdireccion() {
        return this.direccion;
    }

    setdireccion(value) {
        this.direccion = value;
    }

    gettelefono() {
        return this.telefono;
    }

    setelefono(value) {
        this.telefono = value;
    }

    getcondicion() {
        return this.condicion;
    }

    setcondicion(value) {
        this.condicion = value;
    }
}