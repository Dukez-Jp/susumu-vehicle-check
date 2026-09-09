export type Role = "Administrator" | "Supervisor" | "Inspector" | "Office";
export interface User {
  id: string;
  name: string;
  username: string;
  role: Role;
  companyId: string;
  locationId: string;
  active: boolean;
}
export interface LoginSession {
  accessToken: string;
  expiresAt: string;
  offlineUntil: string;
  user: User;
}
export interface Vehicle {
  id: string;
  internalNumber: string;
  plate: string | null;
  type: string;
  companyId: string;
  locationId: string;
  currentOdometerKm: number | null;
  active: boolean;
}
export type VehicleInput = Pick<
  Vehicle,
  "internalNumber" | "type" | "currentOdometerKm" | "active"
> & { plate: string; locationId?: string };
export interface ChecklistItem {
  id: string;
  label: string;
  responseType: "status" | "measurement";
  required: boolean;
  unit: string | null;
  minValue: number | null;
  maxValue: number | null;
  allowedStatuses?: ItemStatus[] | null;
}
export interface ChecklistSection {
  id: string;
  title: string;
  items: ChecklistItem[];
}
export interface ChecklistTemplate {
  id: string;
  name: string;
  vehicleType: string;
  version: number;
  published: boolean;
  active: boolean;
  requiresSignature: boolean;
  sections: ChecklistSection[];
}
export type ItemStatus =
  "OK" | "Attention" | "Repair" | "Critical" | "NotApplicable";
export interface InspectionItem {
  itemId: string;
  status: ItemStatus;
  value: number | null;
  notes: string;
  photoIds: string[];
}
export interface Photo {
  id: string;
  inspectionId: string;
  itemId: string | null;
  kind: "Original" | "Annotation" | "Signature";
  originalPhotoId: string | null;
  contentType: string | null;
  sha256: string | null;
  sizeBytes: number | null;
  createdAt: string;
  uploaded: boolean;
}
export interface Inspection {
  id: string;
  vehicleId: string;
  templateId: string;
  templateVersion: number;
  deviceId: string;
  odometerKm: number;
  state: "Draft" | "Finalized";
  startedAt: string;
  finalizedAt: string | null;
  items: InspectionItem[];
  notes: string;
  supersedesInspectionId: string | null;
  correctionReason: string | null;
  signaturePhotoId: string | null;
  version: number;
  createdBy: string;
  createdByName: string;
  receivedAt: string;
  photoUploadState: "Pending" | "Complete";
  photos?: Photo[];
}
export interface DashboardData {
  vehicles: number;
  inspections: number;
  drafts: number;
  finalized: number;
  criticalItems: number;
  pendingPhotos: number;
  recentInspections: Inspection[];
}
export interface AuditRow {
  id: string;
  actorId: string;
  action: string;
  entityId: string;
  at: string;
  details: unknown;
}
export interface UserInput {
  name: string;
  username: string;
  password: string;
  role: Role;
  locationId: string;
}
export interface Company {
  id: string;
  name: string;
  active: boolean;
}
export interface Location {
  id: string;
  companyId: string;
  name: string;
  active: boolean;
}
export interface Employee {
  id: string;
  userId: string | null;
  employeeNumber: string;
  name: string;
  locationId: string;
  active: boolean;
}
export type EmployeeInput = Omit<Employee, "id">;
export interface VehicleType {
  id: string;
  code: string;
  name: string;
  active: boolean;
}
