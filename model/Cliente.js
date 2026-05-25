const Persona = require('./Persona.js')

module.exports = class Cliente extends Persona{ //aun bajo pruebas
    constructor(nombre, apellido, usuario, contrasenia, cedula, direccion, telefono, email) {
        super(nombre, apellido, usuario, contrasenia, cedula, direccion, telefono, "Cliente")
        this.email = email
    }

    getemail() {
        return this.email;
    }

    setemail(value) {
        this.email = value;
    }

    toString(){
        return `${this.nombre}, ${this.apellido}, ${this.usuario}, ${this.contrasenia}, ${this.cedula}, ${this.telefono}, ${this.direccion}, ${this.email}, ${this.condicion}\n`
    }
}