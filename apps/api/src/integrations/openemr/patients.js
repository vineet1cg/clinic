import { openEmrClient } from './client.js';

function toFhirPatient(input) {
  const [given, ...familyParts] = input.fullName.trim().split(/\s+/);
  const telecom = [{ system: 'phone', value: input.mobile, use: 'mobile' }];
  if (input.email) telecom.push({ system: 'email', value: input.email });

  return {
    resourceType: 'Patient',
    active: true,
    name: [{ use: 'official', given: [given], family: familyParts.join(' ') || given }],
    telecom,
    gender: input.gender.toLowerCase(),
    ...(input.dateOfBirth ? { birthDate: input.dateOfBirth } : {}),
    ...(input.address
      ? {
          address: [
            {
              use: 'home',
              text: input.address,
              city: input.city,
              state: input.state,
              postalCode: input.pinCode,
            },
          ],
        }
      : {}),
  };
}

export function findPatientByMobile(phone) {
  const query = new URLSearchParams({ telecom: phone });
  return openEmrClient.request(`/apis/default/fhir/Patient?${query}`);
}

export function createPatient(input) {
  return openEmrClient.request('/apis/default/fhir/Patient', {
    method: 'POST',
    body: JSON.stringify(toFhirPatient(input)),
  });
}
