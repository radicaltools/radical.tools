---
id: "7b7b2c3e-15f3-44dd-a970-e6cd3c3f292b"
type: "requirement"
label: "Leave out what calls nothing"
action: "the system shall read no URL path or address fact from it"
ears_type: "unwanted-behaviour"
rationale: "Measured on Argentum Online: 214 of 230 URL paths were chat commands, and most addresses were licences, CI and links for the browser; they make an application look like it calls what it does not."
unwanted_condition: "a string is a command (a slash and an upper-case word, /SALIR; in VB code any lone segment, /_BUG, /json) or a file beside the code (/../vendor/autoload.php), or an address sits in a comment, in CI configuration (.github/), in a translation file, in a lock file (package-lock.json), on a page's link (href), an XML namespace or a schema reference ($schema, schemaLocation), or is only opened in a browser (ShellExecute, Process.Start; Inet's OpenURL is a call)"
---
