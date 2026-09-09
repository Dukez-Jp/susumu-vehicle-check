import { describe, expect, it } from "vitest";
import { validateEmployee, validateUser } from "../domain";

describe("employee administration", () => {
  it("allows at most forty trimmed characters in the employee number", () => {
    const employee = {
      employeeNumber: "A".repeat(40),
      name: "Equipe",
      locationId: "unit-1",
      userId: null,
      active: true,
    };
    expect(validateEmployee(employee)).toEqual([]);
    expect(
      validateEmployee({
        ...employee,
        employeeNumber: ` ${employee.employeeNumber} `,
      }),
    ).toEqual([]);
    expect(
      validateEmployee({ ...employee, employeeNumber: "A".repeat(41) }).join(
        " ",
      ),
    ).toMatch(/40 caracteres/i);
  });

  it("requires employee identification and an assigned unit", () => {
    expect(
      validateEmployee({
        employeeNumber: " ",
        name: "",
        locationId: "",
        userId: null,
        active: true,
      }),
    ).toHaveLength(3);
  });
  it("allows a staff record without creating an authentication account", () => {
    expect(
      validateEmployee({
        employeeNumber: "EMP-17",
        name: "Equipe teste",
        locationId: "unit-1",
        userId: null,
        active: false,
      }),
    ).toEqual([]);
  });
});
describe("user access validation", () => {
  const input = {
    name: "Equipe",
    username: "office",
    password: "1234567890",
    locationId: "unit-1",
    role: "Office" as const,
  };
  it("follows the API minimum of ten characters and refuses short passwords", () => {
    expect(validateUser(input, true)).toEqual([]);
    expect(
      validateUser({ ...input, password: "123456789" }, true).join(" "),
    ).toMatch(/10 caracteres/);
  });
  it("does not reset a password implicitly on an existing account", () => {
    expect(validateUser({ ...input, password: "" }, false)).toEqual([]);
    expect(
      validateUser({ ...input, username: "has spaces" }, true).join(" "),
    ).toMatch(/sem espaços/);
  });
});
