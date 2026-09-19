export type ProjectLocationFields = {
  project_address: string;
  project_city?: string | null;
  project_state?: string | null;
};

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function toTitleCase(value: string) {
  return normalizeWhitespace(value).replace(/[A-Za-z]+/g, (segment) => {
    return segment[0].toUpperCase() + segment.slice(1).toLowerCase();
  });
}

function getAddressParts(projectAddress: string) {
  const [street = "", city = "", stateAndZip = ""] = projectAddress
    .split(",")
    .map((part) => normalizeWhitespace(part));
  const state = stateAndZip.split(/\s+/)[0] ?? "";

  return {
    street,
    city,
    state,
  };
}

export function getProjectStreetTitle(project: ProjectLocationFields) {
  return getAddressParts(project.project_address).street;
}

export function getProjectStreetGroupLabel(projectAddress: string) {
  const street = getAddressParts(projectAddress).street;
  if (!street) return "Unassigned Street";

  return street.replace(/^\d+\s+/, "").trim() || street;
}

export function renameProjectStreetAddress(
  projectAddress: string,
  nextStreetAddress: string,
) {
  const normalizedStreet = toTitleCase(nextStreetAddress);
  if (!normalizedStreet) return null;

  const [streetLine = "", ...locationParts] = projectAddress
    .split(",")
    .map((part) => normalizeWhitespace(part));
  const houseNumber = streetLine.match(/^(\d+)\s+.+$/)?.[1];
  if (!houseNumber) return null;

  return [`${houseNumber} ${normalizedStreet}`, ...locationParts]
    .filter(Boolean)
    .join(", ");
}

export function getProjectLocationSubtitle(project: ProjectLocationFields) {
  const fallback = getAddressParts(project.project_address);
  const city = normalizeWhitespace(project.project_city ?? "") || fallback.city;
  const state = (
    normalizeWhitespace(project.project_state ?? "") || fallback.state
  ).toUpperCase();

  if (city && state) return `${city}, ${state}`;
  return city || state;
}

export function getProjectMapAddress(project: ProjectLocationFields) {
  return [getProjectStreetTitle(project), getProjectLocationSubtitle(project)]
    .filter(Boolean)
    .join(", ");
}
