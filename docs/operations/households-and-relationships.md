# Households and relationships operations

Updated 10 November 2026. Source basis: S09.01–S09.12 (proposed). Routes are under `/api/parishes/{parish}`; reads need people.read, changes need people.write, both with current MFA and the office module. A household is an office-managed contact/residence unit. Neither household membership nor the household-contact label grants guardianship, shared finances, giving, message, certificate or private-record access.

## Households

- `POST /households`, `PUT /households/{household}` save the name, shared default address, phone and an optional manual envelope identifier. Envelope identifiers are unique within the parish (case-insensitive) through an atomic claim record; changing one releases the old identifier. None is generated automatically.
- `POST /households/{household}/members` with `add`, `update`, `remove` or `set-contact`. Each person has exactly one primary household; moving is an explicit remove followed by add. Members either inherit the shared address or keep their own (students, shared custody, overseas), and responses show each member's effective address, so an address change visibly updates only inheriting members. Removing the household contact clears the label.
- `GET /households`, `/households/{household}` and `/households/{household}/history`. Address, envelope, membership and contact changes keep the replaced value in append-only history.

## Relationships

- `POST /people/{person}/relationships` records how a related person relates to a person: Parent, Child, AdoptiveParent, AdoptiveChild, StepParent, StepChild, Spouse, Sibling, Guardian, Ward or Relative, with a source. The mirror relationship is stored in the same transaction, so both people's lists agree. Unrecorded relatives are simply absent; nothing is inferred.
- A person cannot become their own ancestor (recorded biological/adoptive parentage is checked upward), cannot have more than two recorded biological parents, and duplicate relationships are rejected. Guardian/Ward links need an actual evidence reference.
- `POST /people/{person}/relationships/{relationship}/end` ends both directions with a reason; `GET /people/{person}/relationships` lists them.

Not implemented: guardian-scoped access for members (guardian registrations, consent and requests on a child's behalf), guided merge/split previews beyond the member primitives, the opt-in directory, operational exports and household dissolution.
