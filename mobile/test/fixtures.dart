import 'package:susumu_vehicle_check/domain.dart';

Json vehicle() => {
  'id': 'vehicle-1',
  'internalNumber': '714',
  'plate': 'DEV-714',
  'type': 'Truck',
  'currentOdometerKm': 1200,
  'active': true,
};
Json template() => {
  'id': 'template-1',
  'name': 'Segurança',
  'vehicleType': 'Truck',
  'version': 3,
  'published': true,
  'sections': [
    {
      'id': 'section-1',
      'title': 'Freios',
      'items': [
        {
          'id': 'item-1',
          'label': 'Pressão',
          'responseType': 'measurement',
          'required': true,
          'unit': 'bar',
          'minValue': 1,
          'maxValue': 10,
        },
      ],
    },
  ],
};
InspectionDraft draft() => InspectionDraft.create(
  id: 'inspection-1',
  vehicle: vehicle(),
  template: template(),
  deviceId: 'device-1',
  now: DateTime.utc(2026, 9, 9),
);
