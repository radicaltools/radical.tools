---
id: "140911f0-ddb3-4ecf-a05a-55c64e299e7a"
type: "requirement"
label: "Follow a value to where it is set"
action: "the system shall read the value that constant, variable, field or setting holds where the unit sets it, as if the code had named it, and an empty setting as none"
ears_type: "event-driven"
rationale: "Legacy programs keep their addresses in constants, records and settings files: measured on three held-out VB6 repositories, every call to a server or a database went through one."
trigger: "a unit's VB6 code gives a socket's port or host (RemotePort, RemoteHost, LocalPort, Connect) or a connection string's server or database through a constant, a variable or a field it assigns elsewhere in the unit, or a setting it reads from an INI file (ReadIni, GetPrivateProfileString)"
---
