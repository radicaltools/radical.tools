---
id: "2046ca00-594a-4946-a08c-d39ad64559b6"
type: "requirement"
label: "Read settings files"
action: "the system shall read a port a key names (Port, StartPort, ListenPort) as a port the unit listens on, and a section that gives a host (IP, Host, Server, Address) and a single port-like number as an address of the unit, each with its file and line; a form's fields named for a host and a port, holding them by default, are an address of the unit, and a form's port field beside a listening socket a port it listens on"
ears_type: "event-driven"
rationale: "A VB6 application keeps where it listens and whom it calls in INI files, not in code: a game client's server list, a server's StartPort."
trigger: "a unit holds INI-style settings (an .ini file, or a .dat, .cfg or .conf file of [sections] in its root or in a settings folder), or a VB6 form whose text fields hold a host and a port by default"
---
