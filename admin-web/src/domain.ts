import type {
  ChecklistTemplate,
  EmployeeInput,
  ItemStatus,
  UserInput,
  VehicleInput,
  VehicleType,
} from "./types";

export interface ItemDraft {
  key: string;
  label: string;
  responseType: "status" | "measurement";
  required: boolean;
  unit: string;
  minValue: string;
  maxValue: string;
  allowedStatuses: ItemStatus[] | null;
}
export interface SectionDraft {
  key: string;
  title: string;
  items: ItemDraft[];
}
export interface TemplateDraft {
  name: string;
  vehicleType: string;
  requiresSignature: boolean;
  sections: SectionDraft[];
}
export const MEASUREMENT_LIMIT = 99_999_999_999_999;
export const ITEM_STATUSES: ItemStatus[] = [
  "OK",
  "Attention",
  "Repair",
  "Critical",
  "NotApplicable",
];

// Compare the entered decimal exactly before Number/JSON can round it. The API
// stores four decimal places; trailing zeros and scientific notation are valid.
function measurementUnits(value: string): bigint | null {
  const match = /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:e([+-]?\d+))?$/i.exec(
    value,
  );
  if (!match) return null;
  const fraction = match[3] ?? match[4] ?? "";
  const coefficient = `${match[2] ?? ""}${fraction}`.replace(/^0+/, "");
  if (!coefficient) return 0n;
  const digits = coefficient.replace(/0+$/, "");
  const shift =
    4 -
    fraction.length +
    Number(match[5] ?? 0) +
    coefficient.length -
    digits.length;
  if (!Number.isSafeInteger(shift) || shift < 0 || digits.length + shift > 18)
    return null;
  const units = BigInt(digits) * 10n ** BigInt(shift);
  if (units > BigInt(MEASUREMENT_LIMIT) * 10_000n) return null;
  return match[1] === "-" ? -units : units;
}

export const newItem = (): ItemDraft => ({
  key: crypto.randomUUID(),
  label: "",
  responseType: "status",
  required: true,
  unit: "",
  minValue: "",
  maxValue: "",
  allowedStatuses: null,
});
export const newSection = (): SectionDraft => ({
  key: crypto.randomUUID(),
  title: "",
  items: [newItem()],
});
export function createTemplateDraft(source?: ChecklistTemplate): TemplateDraft {
  return source
    ? {
        name: source.name,
        vehicleType: source.vehicleType,
        requiresSignature: source.requiresSignature ?? false,
        sections: source.sections.map((s) => ({
          key: crypto.randomUUID(),
          title: s.title,
          items: s.items.map((i) => ({
            key: crypto.randomUUID(),
            label: i.label,
            responseType: i.responseType,
            required: i.required,
            unit: i.unit ?? "",
            minValue: i.minValue?.toString() ?? "",
            maxValue: i.maxValue?.toString() ?? "",
            allowedStatuses:
              i.allowedStatuses == null ? null : [...i.allowedStatuses],
          })),
        })),
      }
    : {
        name: "",
        vehicleType: "",
        requiresSignature: false,
        sections: [newSection()],
      };
}
export function validateTemplate(draft: TemplateDraft): string[] {
  const errors: string[] = [];
  if (!draft.name.trim()) errors.push("Informe o nome do checklist.");
  if (!draft.vehicleType.trim()) errors.push("Informe o tipo de veículo.");
  if (!draft.sections.length) errors.push("Adicione pelo menos uma seção.");
  draft.sections.forEach((s, n) => {
    const section = s.title.trim() || `Seção ${n + 1}`;
    if (!s.title.trim()) errors.push(`${section}: informe o título.`);
    if (!s.items.length)
      errors.push(`${section}: adicione pelo menos um item.`);
    s.items.forEach((item, index) => {
      const label = `${section}, item ${index + 1}`;
      if (!item.label.trim()) errors.push(`${label}: informe a descrição.`);
      const statuses = item.allowedStatuses ?? ITEM_STATUSES;
      if (!statuses.length)
        errors.push(`${label}: selecione pelo menos uma opção de resposta.`);
      else if (
        new Set(statuses).size !== statuses.length ||
        statuses.some((status) => !ITEM_STATUSES.includes(status))
      )
        errors.push(`${label}: use apenas opções padrão, sem repetições.`);
      else if (
        item.required &&
        statuses.every((status) => status === "NotApplicable")
      )
        errors.push(
          `${label}: um item obrigatório precisa de uma opção além de Não aplicável.`,
        );
      if (item.responseType === "measurement") {
        if (!item.unit.trim())
          errors.push(`${label}: informe a unidade da medição.`);
        const min = item.minValue.trim();
        const max = item.maxValue.trim();
        const bounds = [min, max].filter(Boolean);
        const minUnits = min ? measurementUnits(min) : null;
        const maxUnits = max ? measurementUnits(max) : null;
        if (
          (min && !Number.isFinite(Number(min))) ||
          (max && !Number.isFinite(Number(max)))
        )
          errors.push(`${label}: os limites precisam ser um número válido.`);
        else if ((min && minUnits === null) || (max && maxUnits === null))
          errors.push(
            `${label}: use até 4 casas decimais e limites entre -99.999.999.999.999 e 99.999.999.999.999.`,
          );
        else if (
          bounds.some(
            (value) =>
              measurementUnits(JSON.stringify(Number(value))) !==
              measurementUnits(value),
          )
        )
          errors.push(
            `${label}: o limite informado não pode ser enviado sem alterar seu valor. Use menos casas decimais ou um valor menor.`,
          );
        else if (minUnits !== null && maxUnits !== null && minUnits > maxUnits)
          errors.push(
            `${label}: o limite mínimo não pode ser maior que o máximo.`,
          );
      }
    });
  });
  return errors;
}
export function templatePayload(draft: TemplateDraft) {
  return {
    name: draft.name.trim(),
    vehicleType: draft.vehicleType.trim(),
    requiresSignature: draft.requiresSignature,
    sections: draft.sections.map((s) => ({
      title: s.title.trim(),
      items: s.items.map((i) => ({
        label: i.label.trim(),
        responseType: i.responseType,
        required: i.required,
        allowedStatuses:
          i.allowedStatuses == null ? null : [...i.allowedStatuses],
        unit: i.responseType === "measurement" ? i.unit.trim() : null,
        minValue:
          i.responseType === "measurement" && i.minValue.trim()
            ? Number(i.minValue)
            : null,
        maxValue:
          i.responseType === "measurement" && i.maxValue.trim()
            ? Number(i.maxValue)
            : null,
      })),
    })),
  };
}
export function validateVehicle(
  vehicle: VehicleInput,
  previousOdometer?: number | null,
): string[] {
  const errors: string[] = [];
  if (!vehicle.internalNumber.trim()) errors.push("Informe o número interno.");
  if (!vehicle.type.trim()) errors.push("Informe o tipo de veículo.");
  if (vehicle.currentOdometerKm == null) {
    if (previousOdometer != null)
      errors.push("Uma quilometragem já registrada não pode ser apagada.");
  } else if (
    !Number.isInteger(vehicle.currentOdometerKm) ||
    vehicle.currentOdometerKm < 0 ||
    vehicle.currentOdometerKm > 2_147_483_647
  )
    errors.push(
      "Informe uma quilometragem inteira entre 0 e 2.147.483.647 km.",
    );
  else if (
    previousOdometer != null &&
    vehicle.currentOdometerKm < previousOdometer
  )
    errors.push("A quilometragem não pode ser reduzida.");
  return errors;
}
export function photoSummary(inspection: {
  photoUploadState: string;
  items: { photoIds: string[] }[];
  photos?: { id: string; uploaded: boolean }[];
  signaturePhotoId?: string | null;
}) {
  const declaredIds = new Set(inspection.items.flatMap((i) => i.photoIds));
  if (inspection.signaturePhotoId) declaredIds.add(inspection.signaturePhotoId);
  // Metadata may also contain a separately declared signature.
  for (const photo of inspection.photos || []) declaredIds.add(photo.id);
  const uploadedIds = new Set(
    (inspection.photos || []).filter((p) => p.uploaded).map((p) => p.id),
  );
  const uploaded = [...declaredIds].filter((id) => uploadedIds.has(id)).length;
  return {
    declared: declaredIds.size,
    uploaded,
    complete:
      inspection.photoUploadState === "Complete" &&
      uploaded === declaredIds.size,
  };
}
export function validateEmployee(employee: EmployeeInput): string[] {
  const errors: string[] = [];
  if (!employee.employeeNumber.trim())
    errors.push("Informe a matrícula do funcionário.");
  else if (employee.employeeNumber.trim().length > 40)
    errors.push("A matrícula deve ter no máximo 40 caracteres.");
  if (!employee.name.trim()) errors.push("Informe o nome do funcionário.");
  if (!employee.locationId) errors.push("Selecione a unidade do funcionário.");
  return errors;
}
export function validateUser(user: UserInput, creating: boolean): string[] {
  const errors: string[] = [];
  if (!user.name.trim()) errors.push("Informe o nome.");
  if (
    creating &&
    (user.username.trim().length < 3 ||
      user.username.trim().length > 120 ||
      /\s/.test(user.username.trim()))
  )
    errors.push("O usuário deve ter de 3 a 120 caracteres, sem espaços.");
  if (!user.locationId) errors.push("Selecione a unidade do usuário.");
  if (
    (creating || user.password) &&
    (user.password.length < 10 || !user.password.trim())
  )
    errors.push("A senha deve ter pelo menos 10 caracteres.");
  if (user.password.length > 256)
    errors.push("A senha deve ter no máximo 256 caracteres.");
  return errors;
}

export function validateVehicleType(
  input: Pick<VehicleType, "code" | "name">,
  catalog: VehicleType[] = [],
  existingId?: string,
): string[] {
  const errors: string[] = [];
  const code = input.code.trim();
  const name = input.name.trim();
  const hasControl = (value: string) =>
    [...value].some((character) => {
      const point = character.codePointAt(0)!;
      return point < 32 || (point >= 127 && point <= 159);
    });
  if (!code || code.length > 80 || hasControl(code))
    errors.push(
      "O código deve ter de 1 a 80 caracteres, sem caracteres de controle.",
    );
  if (!name || name.length > 120 || hasControl(name))
    errors.push(
      "O nome deve ter de 1 a 120 caracteres, sem caracteres de controle.",
    );
  if (
    catalog.some(
      (type) =>
        type.id !== existingId &&
        type.code.toLowerCase() === code.toLowerCase(),
    )
  )
    errors.push("Já existe um tipo com esse código nesta empresa.");
  return errors;
}

export function validateVehicleTypeAssignment(
  code: string,
  catalog: VehicleType[],
  existingCode?: string,
): string[] {
  if (code && code === existingCode) return [];
  return catalog.some(
    (type) =>
      type.active && type.code.toLowerCase() === code.trim().toLowerCase(),
  )
    ? []
    : ["Selecione um tipo de veículo ativo no catálogo da empresa."];
}
