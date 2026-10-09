import { describe, expect, it } from "vitest";
import { splitNombreCompleto, clienteToDerechohabiente, clienteToPropietario, propiedadToVivienda } from "./solicitudAvaluo";

describe("splitNombreCompleto", () => {
  it("separa nombre + 2 apellidos (caso más común)", () => {
    expect(splitNombreCompleto("Juan Perez Garcia")).toEqual({ nombres: "Juan", apellidoPaterno: "Perez", apellidoMaterno: "Garcia" });
  });

  it("separa nombre compuesto + 2 apellidos", () => {
    expect(splitNombreCompleto("Juan Carlos Perez Garcia")).toEqual({
      nombres: "Juan Carlos",
      apellidoPaterno: "Perez",
      apellidoMaterno: "Garcia",
    });
  });

  it("con solo 2 palabras, la segunda se toma como apellido paterno", () => {
    expect(splitNombreCompleto("Juan Perez")).toEqual({ nombres: "Juan", apellidoPaterno: "Perez", apellidoMaterno: "" });
  });

  it("con 1 palabra, todo va a nombres", () => {
    expect(splitNombreCompleto("Juan")).toEqual({ nombres: "Juan", apellidoPaterno: "", apellidoMaterno: "" });
  });

  it("vacío o nulo no truena", () => {
    expect(splitNombreCompleto("")).toEqual({ nombres: "", apellidoPaterno: "", apellidoMaterno: "" });
    expect(splitNombreCompleto(undefined)).toEqual({ nombres: "", apellidoPaterno: "", apellidoMaterno: "" });
  });

  it("recorta espacios extra entre palabras", () => {
    expect(splitNombreCompleto("  Juan   Perez   Garcia  ")).toEqual({ nombres: "Juan", apellidoPaterno: "Perez", apellidoMaterno: "Garcia" });
  });
});

describe("clienteToDerechohabiente", () => {
  it("sin cliente no aporta nada", () => {
    expect(clienteToDerechohabiente(null, null)).toEqual({});
  });

  it("usa el cliente cuando no hay perfilamiento de comprador", () => {
    const client = { name: "Juan Perez Garcia", phone: "8711234567", nss: "12345678901" };
    expect(clienteToDerechohabiente(client, null)).toEqual({
      nss: "12345678901",
      dh_apellido_paterno: "Perez",
      dh_apellido_materno: "Garcia",
      dh_nombres: "Juan",
      dh_telefono_celular: "8711234567",
    });
  });

  it("prefiere los datos del perfilamiento de comprador sobre los del cliente", () => {
    const client = { name: "Juan Perez Garcia", phone: "8711234567", nss: "12345678901" };
    const perfil = { nombre: "Juan Carlos Perez Garcia", nss: "99999999999", telefono: "8719999999", domicilio: "Calle Hidalgo 123, Centro" };
    expect(clienteToDerechohabiente(client, perfil)).toEqual({
      nss: "99999999999",
      dh_apellido_paterno: "Perez",
      dh_apellido_materno: "Garcia",
      dh_nombres: "Juan Carlos",
      dh_calle_numero: "Calle Hidalgo 123, Centro",
      dh_telefono_celular: "8719999999",
    });
  });

  it("no incluye claves vacías", () => {
    const client = { name: "Juan" };
    expect(clienteToDerechohabiente(client, null)).toEqual({ dh_nombres: "Juan" });
  });
});

describe("clienteToPropietario", () => {
  it("sin cliente no aporta nada", () => {
    expect(clienteToPropietario(null, null)).toEqual({});
  });

  it("usa el cliente cuando no hay perfilamiento de vendedor", () => {
    const client = { name: "Ana Lopez Diaz", phone: "8715551234" };
    expect(clienteToPropietario(client, null)).toEqual({
      prop_apellido_paterno: "Lopez",
      prop_apellido_materno: "Diaz",
      prop_nombre_razon_social: "Ana Lopez Diaz",
      prop_telefono_celular: "8715551234",
    });
  });

  it("usa el RFC y domicilio del perfilamiento de vendedor cuando existe", () => {
    const client = { name: "Ana Lopez Diaz", phone: "8715551234" };
    const perfil = { nombre_completo: "Ana Lopez Diaz", rfc: "LODA800101AAA", domicilio: "Calle Morelos 45", telefono: "8710001111" };
    expect(clienteToPropietario(client, perfil)).toEqual({
      prop_apellido_paterno: "Lopez",
      prop_apellido_materno: "Diaz",
      prop_nombre_razon_social: "Ana Lopez Diaz",
      prop_rfc: "LODA800101AAA",
      prop_calle_numero: "Calle Morelos 45",
      prop_telefono_celular: "8710001111",
    });
  });
});

describe("propiedadToVivienda", () => {
  it("sin propiedad no aporta nada", () => {
    expect(propiedadToVivienda(null)).toEqual({});
  });

  it("toma calle de address y colonia de zone", () => {
    expect(propiedadToVivienda({ address: "Calle Morelos 45", zone: "Centro" })).toEqual({
      viv_calle: "Calle Morelos 45",
      viv_colonia: "Centro",
    });
  });
});
