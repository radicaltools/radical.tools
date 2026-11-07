---
id: "e0b4156b-e187-48dc-9e46-c9abcfeb8857"
type: "scenario"
label: "Commands and comments left out"
given: "VB6 code with the chat commands \"/SALIR\" and \"/_BUG\", a URL in a comment, a URL opened with ShellExecute, a URL called with XMLHTTP, one read with Inet's OpenURL, and a .github/config.yml with a URL"
then: "only the URLs called with XMLHTTP and OpenURL are facts"
when: "Assay reads it"
---
