/**
 * Measured against the immutable source PDF, page 1.
 * Coordinates are PDF points, with the origin at the top left.
 * Boxes occupy blank interiors only; existing labels and rules stay visible.
 * Dates use separate numeric boxes because Japanese units are already printed.
 * This layout is for the review prototype, not a finalized inspection record.
 */
export const PAGE_WIDTH = 841.68;
export const PAGE_HEIGHT = 595.2;

export interface PrintBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly fontSize: number;
}

export const headerBoxes = {
  inspectionMonths: { x: 80, y: 66, width: 18, height: 15, fontSize: 12 },
  ownerName: { x: 305, y: 41, width: 193, height: 13, fontSize: 8 },
  ownerAddress: { x: 305, y: 66, width: 193, height: 12, fontSize: 7 },
  // The original provides one field for registration number OR chassis number.
  plateOrChassis: { x: 504, y: 43, width: 128, height: 12, fontSize: 8 },
  vehicleNameAndModel: { x: 504, y: 67, width: 128, height: 12, fontSize: 7.5 },
  engineModel: { x: 638, y: 67, width: 59, height: 12, fontSize: 7.5 },
  firstRegistrationYear: { x: 638, y: 44, width: 19, height: 11, fontSize: 7 },
  firstRegistrationMonth: { x: 666, y: 44, width: 12, height: 11, fontSize: 7 },
  remarks: { x: 704, y: 43, width: 112, height: 35, fontSize: 7 },
  workshopName: { x: 306, y: 537, width: 311, height: 10, fontSize: 8 },
  workshopAddress: { x: 306, y: 549, width: 311, height: 10, fontSize: 7 },
  workshopCertificationNumber: {
    x: 306,
    y: 563,
    width: 311,
    height: 10,
    fontSize: 7,
  },
  maintenanceSupervisor: { x: 703, y: 527, width: 92, height: 10, fontSize: 8 },
  inspectionYear: { x: 704, y: 540, width: 28, height: 10, fontSize: 8 },
  inspectionMonth: { x: 743, y: 540, width: 15, height: 10, fontSize: 8 },
  inspectionDay: { x: 770, y: 540, width: 15, height: 10, fontSize: 8 },
  completionYear: { x: 704, y: 553, width: 28, height: 10, fontSize: 8 },
  completionMonth: { x: 743, y: 553, width: 15, height: 10, fontSize: 8 },
  completionDay: { x: 770, y: 553, width: 15, height: 10, fontSize: 8 },
  odometerKm: { x: 704, y: 566, width: 69, height: 9, fontSize: 8 },
  coPercent: { x: 241, y: 553, width: 50, height: 9, fontSize: 8 },
  hcPpm: { x: 241, y: 566, width: 44, height: 9, fontSize: 8 },
} as const satisfies Record<string, PrintBox>;

export type PrintHeaderField = keyof typeof headerBoxes;

/** Japanese-only sample notice, in the unused margin above the original form. */
export const sampleNoticeBox: PrintBox = {
  x: 620,
  y: 14,
  width: 195,
  height: 12,
  fontSize: 8,
};
