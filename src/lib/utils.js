export const cn = (...classes) => classes.filter(Boolean).join(" ");

export const formatDateTime = (value) => {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
};

export const formatAssetIdentifier = (asset = {}) => {
  const primaryLabel = asset.tag_code
    ? `Patrimonio ${asset.tag_code}`
    : asset.serial_number
      ? `Serie ${asset.serial_number}`
      : asset.host_name || asset.domain_name || asset.model || "Ativo sem identificador";

  const details = [asset.model, asset.serial_number ? `S/N ${asset.serial_number}` : ""]
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index)
    .join(" - ");

  return details && !primaryLabel.includes(details)
    ? `${primaryLabel} - ${details}`
    : primaryLabel;
};

export const buildLocationOptions = ({ rooms = [], labs = [] }) =>
  [
    ...rooms
      .filter((room) => room.is_active !== false)
      .map((room) => ({
        key: `room:${room.id}`,
        id: room.id,
        type: "room",
        label: `${room.name} (Sala)`,
        name: room.name,
        description: [room.building, room.floor].filter(Boolean).join(" - ")
      })),
    ...labs.map((lab) => ({
      key: `lab:${lab.id}`,
      id: lab.id,
      type: "lab",
      label: `${lab.name} (Laboratorio)`,
      name: lab.name,
      description: lab.location || ""
    }))
  ].sort((left, right) => left.label.localeCompare(right.label, "pt-BR"));
